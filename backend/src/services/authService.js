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
import { enqueueWelcomeEmail, enqueueVerificationEmail } from "../jobs/emailQueue.js";
import { randomCode, sha256 } from "../utils/crypto.js";
import { referralService } from "./referralService.js";
import { planLimitService } from "./planLimitService.js";
import { appleService } from "./appleService.js";

const googleClient = env.googleClientId ? new OAuth2Client(env.googleClientId) : null;
const REFERRAL_PREFIX = "REF-";
const CONVERSION_STATUSES = new Set(["CONVERTED", "REWARDED"]);
const EMAIL_VERIFICATION_TOKEN_TTL_MS = 1000 * 60 * 60 * 24;
const REFERRAL_TRIAL_PLAN = "PRO";
const REFERRAL_TRIAL_DAYS = 14;

const isLoginBlockedStatus = (status) => status === "SUSPENDED" || status === "DELETED";

const resolveUsername = (user) => user?.photographer?.username || user?.username || null;
const normalizeEmail = (value = "") => String(value || "").trim().toLowerCase();

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
    emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
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
    select: { id: true, email: true },
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
    email: referrer.email,
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
  if (
    !resolved ||
    resolved.referrerUserId === referredUserId ||
    normalizeEmail(resolved.email) === normalizeEmail(referredEmail)
  ) {
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

const grantReferralVerificationTrialTx = async (tx, userId) => {
  if (!userId || !tx?.referral?.findUnique || !tx?.subscription) {
    return { updated: false };
  }

  const referral = await tx.referral.findUnique({
    where: { referredUserId: userId },
    select: {
      id: true,
      referrerUserId: true,
      status: true,
      trialGrantedAt: true,
    },
  });

  if (
    !referral ||
    referral.trialGrantedAt ||
    referral.referrerUserId === userId ||
    !["CLICKED", "SIGNED_UP"].includes(referral.status)
  ) {
    return { updated: false };
  }

  const user = await tx.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      photographer: {
        select: { id: true },
      },
    },
  });

  if (!user) {
    return { updated: false };
  }

  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + REFERRAL_TRIAL_DAYS * 24 * 60 * 60 * 1000);

  const existingSubscription = await tx.subscription.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      plan: true,
      photographerId: true,
      startedAt: true,
      status: true,
      trialEndsAt: true,
    },
  });

  if (existingSubscription && existingSubscription.plan !== "FREE") {
    return { updated: false };
  }

  const subscriptionData = {
    photographerId: existingSubscription?.photographerId || user.photographer?.id || null,
    plan: REFERRAL_TRIAL_PLAN,
    status: "TRIALING",
    provider: "MANUAL",
    billingInterval: "MONTHLY",
    currentPeriodStart: now,
    currentPeriodEnd: trialEndsAt,
    pendingPlan: null,
    pendingBillingInterval: null,
    cancelAtPeriodEnd: false,
    canceledAt: null,
    trialEndsAt,
    startedAt: existingSubscription?.startedAt || now,
  };

  if (existingSubscription) {
    await tx.subscription.update({
      where: { id: existingSubscription.id },
      data: subscriptionData,
    });
  } else {
    await tx.subscription.create({
      data: {
        userId,
        ...subscriptionData,
      },
    });
  }

  await tx.referral.update({
    where: { id: referral.id },
    data: { trialGrantedAt: now },
  });

  logger.info(
    {
      userId,
      referralId: referral.id,
      trialEndsAt: trialEndsAt.toISOString(),
    },
    "Referral trial granted"
  );

  return { updated: true, trialEndsAt };
};

const issueEmailVerificationTokenTx = async (tx, userId) => {
  const token = randomCode("ver_");
  const tokenHash = sha256(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + EMAIL_VERIFICATION_TOKEN_TTL_MS);

  await tx.emailVerificationToken.updateMany({
    where: {
      userId,
      usedAt: null,
    },
    data: { usedAt: now },
  });

  await tx.emailVerificationToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return token;
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

  const { user, isNewAccount } = await prisma.$transaction(async (tx) => {
    let user = await tx.user.findUnique({
      where: { email },
      include: { photographer: true },
    });
    let created = false;
    const wasUnverified = Boolean(user && !user.emailVerifiedAt);

    if (!user) {
      user = await tx.user.create({
        data: {
          email,
          fullName: (name || email).slice(0, 191),
          googleId: googleSub,
          emailVerifiedAt: now,
          role: "PHOTOGRAPHER",
          status: "ACTIVE",
          lastLoginAt: now,
        },
        include: { photographer: true },
      });
      created = true;

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
        ...(wasUnverified ? { emailVerifiedAt: now } : {}),
        ...(normalizedName && !user.fullName ? { fullName: normalizedName } : {}),
      },
      include: { photographer: true },
    });

    if (created || wasUnverified) {
      await grantReferralVerificationTrialTx(tx, user.id);
    }

    return { user, isNewAccount: created };
  });

  if (isNewAccount) {
    dispatchWelcomeEmailAsync({
      email: user.email,
      fullName: user.fullName,
      requestId: null,
    });
  }

  return authResponse(user);
};


const handleAppleLogin = async ({ appleProfile, fullName, referralCode } = {}) => {
  const appleSub = appleProfile?.sub || null;
  const email = normalizeEmail(appleProfile?.email || "");
  const emailVerifiedToken = appleProfile?.email_verified;
  const isEmailVerified =
    emailVerifiedToken === true || String(emailVerifiedToken || "").trim().toLowerCase() === "true";

  if (!appleSub) {
    throw new ApiError(401, "Apple token invalid");
  }

  const now = new Date();

  const { user, isNewAccount } = await prisma.$transaction(async (tx) => {
    let user = await tx.user.findUnique({
      where: { appleId: appleSub },
      include: { photographer: true },
    });

    if (!user && email) {
      user = await tx.user.findUnique({
        where: { email },
        include: { photographer: true },
      });
    }

    let created = false;
    const wasUnverified = Boolean(user && !user.emailVerifiedAt);

    if (!user) {
      if (!email) {
        throw new ApiError(400, "Apple sign-in did not provide an email address");
      }

      user = await tx.user.create({
        data: {
          email,
          fullName: (fullName || email).slice(0, 191),
          appleId: appleSub,
          emailVerifiedAt: isEmailVerified ? now : null,
          role: "PHOTOGRAPHER",
          status: "ACTIVE",
          lastLoginAt: now,
        },
        include: { photographer: true },
      });
      created = true;

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

    const normalizedName = String(fullName || "").trim().slice(0, 191);

    user = await tx.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: now,
        ...(appleSub && user.appleId !== appleSub ? { appleId: appleSub } : {}),
        ...(wasUnverified && isEmailVerified ? { emailVerifiedAt: now } : {}),
        ...(normalizedName && !user.fullName ? { fullName: normalizedName } : {}),
      },
      include: { photographer: true },
    });

    if (created || (wasUnverified && isEmailVerified)) {
      await grantReferralVerificationTrialTx(tx, user.id);
    }

    return { user, isNewAccount: created };
  });

  if (isNewAccount) {
    dispatchWelcomeEmailAsync({
      email: user.email,
      fullName: user.fullName,
      requestId: null,
    });
  }

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

const dispatchVerificationEmailAsync = ({ email, fullName, token, requestId = null }) => {
  if (!email || !token) return;

  void (async () => {
    const job = await enqueueVerificationEmail({
      email,
      fullName,
      token,
      requestId,
    });

    if (job) return;

    await emailService.sendVerificationEmail(email, fullName || "there", token);
  })().catch((error) => {
    logger.error(
      {
        err: error,
        email,
        requestId,
      },
      "Failed to deliver verification email asynchronously"
    );
    captureException(error, {
      service: "authService",
      action: "dispatchVerificationEmailAsync",
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
    const now = new Date();
    const { user } = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          fullName,
          email,
          passwordHash,
          role: "PHOTOGRAPHER",
          emailVerifiedAt: now,
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

      await grantReferralVerificationTrialTx(tx, createdUser.id);
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
    const wasUnverified = !user.emailVerifiedAt;

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new ApiError(401, "Invalid credentials");

    const verifiedAt = wasUnverified ? new Date() : null;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        ...(verifiedAt ? { emailVerifiedAt: verifiedAt } : {}),
      },
    });

    await ensurePhotographerProfile(user);

    if (verifiedAt) {
      user.emailVerifiedAt = verifiedAt;
      await prisma.$transaction(async (tx) => grantReferralVerificationTrialTx(tx, user.id));
    }

    return authResponse(user);
  },

  handleGoogleLogin,
  handleAppleLogin,

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
  async appleAuth({ idToken, code, fullName, referralCode } = {}) {
    if (!env.appleAuth?.enabled) {
      throw new ApiError(404, "Apple sign-in is not enabled");
    }

    const normalizedName = String(fullName || "").trim().slice(0, 191) || null;

    let profile = null;
    if (env.appleAuth?.tokenExchangeEnabled) {
      if (!code) {
        throw new ApiError(400, "Missing Apple authorization code");
      }

      const tokenResponse = await appleService.exchangeAuthorizationCode(code);
      const exchangedIdToken = String(tokenResponse?.id_token || "").trim();
      if (!exchangedIdToken) {
        throw new ApiError(401, "Apple sign-in failed");
      }

      profile = await appleService.verifyIdToken(exchangedIdToken);
    } else {
      if (!idToken) {
        throw new ApiError(400, "Missing Apple token");
      }
      profile = await appleService.verifyIdToken(idToken);
    }

    return handleAppleLogin({ appleProfile: profile, fullName: normalizedName, referralCode });
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

  async verifyEmail({ token }, options = {}) {
    void token;
    void options;
    return { message: "Email verification is no longer required." };
  },

  async resendVerification({ email, userId }, options = {}) {
    void email;
    void userId;
    void options;
    return { message: "Email verification is no longer required." };
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

    const plan = await planLimitService.getPlanByUserId(user.id);
    const entitlements = planLimitService.toEntitlements(plan);
    const leadFeatures = planLimitService.getLeadFeatureAccess(plan);
    const planLimits = planLimitService.mapPlanLimits(plan);

    return {
      id: user.id,
      role: user.role,
      fullName: user.fullName,
      email: user.email,
      emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
      username: user.photographer?.username || user.username,
      plan: plan?.name || (user.photographer ? "FREE" : null),
      status: user.status,
      entitlements,
      leadFeatures,
      planFeatures: {
        teamSectionTools: Boolean(planLimits.teamSectionTools),
        hideBrandingEnabled: Boolean(entitlements?.features?.hideBrandingEnabled),
        customDomainEnabled: Boolean(entitlements?.features?.customDomainEnabled),
        analyticsEnabled: Boolean(entitlements?.features?.analyticsEnabled),
      },
    };
  },
};


