import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { captureException } from "../config/sentry.js";
import { ApiError } from "../utils/apiError.js";
import { generateUsername } from "../utils/generateUsername.js";
import { signAccessToken, signRefreshToken, verifyToken } from "../utils/jwt.js";
import { emailService } from "./emailService.js";
import { enqueueWelcomeEmail } from "../jobs/emailQueue.js";
import { randomCode, sha256 } from "../utils/crypto.js";
import { referralService } from "./referralService.js";

const googleClient = env.googleClientId ? new OAuth2Client(env.googleClientId) : null;
const REFERRAL_PREFIX = "REF-";
const CONVERSION_STATUSES = new Set(["CONVERTED", "REWARDED"]);

const isLoginBlockedStatus = (status) => status === "SUSPENDED" || status === "DELETED";

const resolveUsername = (user) => user?.photographer?.username || user?.username || null;

const makeTokenPayload = (user) => ({
  sub: user.id,
  role: user.role,
  email: user.email,
  username: resolveUsername(user),
});

const authResponse = (user) => ({
  user: {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    username: resolveUsername(user),
    role: user.role,
    status: user.status,
  },
  accessToken: signAccessToken(makeTokenPayload(user)),
  refreshToken: signRefreshToken({ sub: user.id, type: "refresh" }),
  expiresIn: env.jwtExpiresIn,
});

const ensurePhotographerProfile = async (user, db = prisma) => {
  if (user.role !== "PHOTOGRAPHER") {
    return null;
  }

  const existing = await db.photographer.findUnique({ where: { userId: user.id } });
  if (existing) {
    return existing;
  }

  const usernameSeed = user.username || user.fullName || user.email.split("@")[0];
  const username = await generateUsername(usernameSeed, db);
  const studioName = (user.fullName || username).slice(0, 191);

  return db.photographer.create({
    data: {
      userId: user.id,
      username,
      studioName,
      websiteUrl: `${username}.${env.publicAppDomain}`,
    },
  });
};

const initializeDefaultSubscription = async ({ tx, userId, photographerId }) => {
  const freePlan = await tx.subscriptionPlan.findFirst({
    where: { name: "FREE" },
    select: { name: true, trialDays: true },
  });

  if (!freePlan) {
    throw new ApiError(500, "Default FREE plan is not configured");
  }

  const now = new Date();
  const trialDays = Number(freePlan.trialDays || 0);
  const trialEndsAt =
    trialDays > 0
      ? new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000)
      : null;

  return tx.subscription.create({
    data: {
      userId,
      photographerId: photographerId || null,
      plan: freePlan.name,
      status: trialEndsAt ? "TRIALING" : "ACTIVE",
      startedAt: now,
      currentPeriodStart: now,
      trialEndsAt,
    },
  });
};

const resolveReferrerByCodeTx = async (tx, referralCode) => {
  const normalizedCode = referralService.normalizeReferralCode(referralCode);
  if (!normalizedCode) {
    return null;
  }

  const token = normalizedCode.startsWith(REFERRAL_PREFIX)
    ? normalizedCode.slice(REFERRAL_PREFIX.length)
    : normalizedCode;

  let referrer = await tx.user.findFirst({
    where: {
      OR: [{ username: token }, { photographer: { is: { username: token } } }],
    },
    select: { id: true },
  });

  if (!referrer && token.length >= 6) {
    referrer = await tx.user.findFirst({
      where: { id: { startsWith: token } },
      select: { id: true },
    });
  }

  if (!referrer) {
    return null;
  }

  return {
    referrerUserId: referrer.id,
    normalizedCode,
  };
};

const markReferralSignedUpTx = async ({
  tx,
  referralCode,
  referredUserId,
  referredEmail,
}) => {
  if (!referredUserId) {
    return { updated: false };
  }

  const resolved = await resolveReferrerByCodeTx(tx, referralCode);
  if (!resolved || resolved.referrerUserId === referredUserId) {
    return { updated: false };
  }

  const { referrerUserId, normalizedCode } = resolved;
  const signupEmail = referredEmail || "A new user";

  const notifyReferrerSignup = async () =>
    tx.notification.create({
      data: {
        userId: referrerUserId,
        type: "MARKETING",
        title: "New referral signup",
        body: `${signupEmail} signed up using your referral code.`,
        actionUrl: "/dashboard/referrals",
      },
    });

  const existingForUser = await tx.referral.findUnique({
    where: { referredUserId },
    select: {
      id: true,
      referrerUserId: true,
      status: true,
      referredEmail: true,
    },
  });

  if (existingForUser) {
    if (existingForUser.referrerUserId !== referrerUserId) {
      return { updated: false };
    }

    const nextStatus = CONVERSION_STATUSES.has(existingForUser.status)
      ? existingForUser.status
      : "SIGNED_UP";

    const updated = await tx.referral.update({
      where: { id: existingForUser.id },
      data: {
        code: normalizedCode,
        status: nextStatus,
        referredEmail: referredEmail || existingForUser.referredEmail,
      },
      select: { id: true },
    });

    if (existingForUser.status === "CLICKED") {
      await notifyReferrerSignup();
    }

    return { updated: true, referralId: updated.id };
  }

  const candidate = await tx.referral.findFirst({
    where: {
      referrerUserId,
      code: normalizedCode,
      referredUserId: null,
      status: { in: ["CLICKED", "SIGNED_UP"] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, referredEmail: true },
  });

  if (candidate) {
    const updated = await tx.referral.update({
      where: { id: candidate.id },
      data: {
        status: "SIGNED_UP",
        referredUserId,
        referredEmail: referredEmail || candidate.referredEmail,
      },
      select: { id: true },
    });

    if (candidate.status !== "SIGNED_UP") {
      await notifyReferrerSignup();
    }

    return { updated: true, referralId: updated.id };
  }

  const created = await tx.referral.create({
    data: {
      referrerUserId,
      referredUserId,
      referredEmail: referredEmail || null,
      code: normalizedCode,
      status: "SIGNED_UP",
    },
    select: { id: true },
  });

  await notifyReferrerSignup();

  return { updated: true, referralId: created.id };
};

const handleGoogleLogin = async ({ googleProfile, referralCode } = {}) => {
  const { email, name, picture } = googleProfile || {};
  const googleSub = googleProfile?.sub || null;
  const isEmailVerified = Boolean(googleProfile?.email_verified);
  void picture;

  if (!email) {
    throw new ApiError(401, "Google token invalid");
  }

  const now = new Date();

  const { user } = await prisma.$transaction(async (tx) => {
    let user = await tx.user.findUnique({
      where: { email },
      include: { photographer: true },
    });

    if (!user) {
      user = await tx.user.create({
        data: {
          email,
          fullName: (name || email).slice(0, 191),
          googleId: googleSub,
          emailVerifiedAt: isEmailVerified ? now : null,
          role: "PHOTOGRAPHER",
          status: "ACTIVE",
          lastLoginAt: now,
        },
        include: { photographer: true },
      });

      const photographer = await ensurePhotographerProfile(user, tx);
      await initializeDefaultSubscription({
        tx,
        userId: user.id,
        photographerId: photographer?.id || null,
      });

      await markReferralSignedUpTx({
        tx,
        referralCode,
        referredUserId: user.id,
        referredEmail: user.email,
      });
    }

    if (isLoginBlockedStatus(user.status)) {
      throw new ApiError(403, "Account is not allowed to log in");
    }

    const normalizedName = (name || "").trim().slice(0, 191);

    user = await tx.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: now,
        ...(googleSub && user.googleId !== googleSub ? { googleId: googleSub } : {}),
        ...(isEmailVerified && !user.emailVerifiedAt ? { emailVerifiedAt: now } : {}),
        ...(normalizedName && !user.fullName ? { fullName: normalizedName } : {}),
      },
      include: { photographer: true },
    });

    return { user };
  });

  return authResponse(user);
};

const dispatchWelcomeEmailAsync = ({ email, fullName, requestId = null }) => {
  if (!email) return;

  void (async () => {
    const job = await enqueueWelcomeEmail({
      email,
      fullName,
      requestId,
    });

    if (job) return;

    await emailService.sendWelcome(email, fullName || "there");
  })().catch((error) => {
    logger.error(
      {
        err: error,
        email,
        requestId,
      },
      "Failed to deliver welcome email asynchronously"
    );
    captureException(error, {
      service: "authService",
      action: "dispatchWelcomeEmailAsync",
      email,
      requestId,
    });
  });
};

export const authService = {
  async signup({ fullName, email, password, referralCode }, options = {}) {
    const requestId = options?.requestId || null;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new ApiError(409, "Email already in use");

    const passwordHash = await bcrypt.hash(password, 10);
    const { user } = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          fullName,
          email,
          passwordHash,
          role: "PHOTOGRAPHER",
        },
      });

      const photographer = await ensurePhotographerProfile(createdUser, tx);
      await initializeDefaultSubscription({
        tx,
        userId: createdUser.id,
        photographerId: photographer?.id || null,
      });

      await markReferralSignedUpTx({
        tx,
        referralCode,
        referredUserId: createdUser.id,
        referredEmail: createdUser.email,
      });

      const fullUser = await tx.user.findUnique({
        where: { id: createdUser.id },
        include: { photographer: true },
      });
      return { user: fullUser };
    });

    if (!user) {
      throw new ApiError(500, "Failed to create account");
    }

    dispatchWelcomeEmailAsync({
      email: user.email,
      fullName: user.fullName,
      requestId,
    });

    return authResponse(user);
  },

  async login({ email, password }) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash) throw new ApiError(401, "Invalid credentials");
    if (isLoginBlockedStatus(user.status)) throw new ApiError(403, "Account is not allowed to log in");

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new ApiError(401, "Invalid credentials");

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await ensurePhotographerProfile(user);

    return authResponse(user);
  },

  handleGoogleLogin,

  async googleAuth({ idToken, referralCode } = {}) {
    if (!googleClient) throw new ApiError(500, "GOOGLE_CLIENT_ID not configured");
    if (!idToken) throw new ApiError(400, "Missing Google token");

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.googleClientId,
    });
    const payload = ticket.getPayload();
    return handleGoogleLogin({ googleProfile: payload, referralCode });
  },

  async refresh({ refreshToken }) {
    const decoded = verifyToken(refreshToken);
    if (decoded.type !== "refresh") throw new ApiError(401, "Invalid refresh token");

    const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
    if (!user) throw new ApiError(401, "Invalid refresh token");
    if (isLoginBlockedStatus(user.status)) throw new ApiError(403, "Account is not allowed to log in");

    return {
      accessToken: signAccessToken(makeTokenPayload(user)),
      expiresIn: env.jwtExpiresIn,
    };
  },

  async forgotPassword({ email }) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return { message: "If that email exists, reset instructions were sent." };

    const token = randomCode("rst_");
    const tokenHash = sha256(token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 1000 * 60 * 30);

    await prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
      data: { usedAt: now },
    });

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    await emailService.sendPasswordReset(email, token);
    return { message: "Reset instructions sent" };
  },

  async resetPassword({ token, newPassword }) {
    const tokenHash = sha256(token || "");
    const record = await prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!record) {
      throw new ApiError(400, "Invalid or expired reset token");
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    await prisma.passwordResetToken.updateMany({
      where: {
        userId: record.userId,
        usedAt: null,
        id: { not: record.id },
      },
      data: { usedAt: new Date() },
    });
    return { message: "Password reset successful" };
  },

  async logout() {
    return { message: "Logged out" };
  },

  async me(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { photographer: true },
    });
    if (!user) throw new ApiError(404, "User not found");
    if (isLoginBlockedStatus(user.status)) throw new ApiError(403, "Account is not allowed to log in");

    const latestSubscription = await prisma.subscription.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { plan: true },
    });

    return {
      id: user.id,
      role: user.role,
      fullName: user.fullName,
      email: user.email,
      username: user.photographer?.username || user.username,
      plan: latestSubscription?.plan || (user.photographer ? "FREE" : null),
      status: user.status,
    };
  },
};
