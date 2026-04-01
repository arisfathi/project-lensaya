import { authService } from "../services/authService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/response.js";
import { env } from "../config/env.js";

const authCookieSecure =
  env.authCookie.sameSite === "none" ? true : env.authCookie.secure;

const authCookieOptions = {
  httpOnly: true,
  secure: authCookieSecure,
  sameSite: env.authCookie.sameSite,
  path: "/",
  ...(env.authCookie.domain ? { domain: env.authCookie.domain } : {}),
};

const setSessionCookies = (res, payload) => {
  if (payload?.accessToken) {
    res.cookie("accessToken", payload.accessToken, authCookieOptions);
  }
  if (payload?.refreshToken) {
    res.cookie("refreshToken", payload.refreshToken, authCookieOptions);
  }
};

const clearSessionCookies = (res) => {
  res.clearCookie("accessToken", authCookieOptions);
  res.clearCookie("refreshToken", authCookieOptions);
};

const sanitizedAuthPayload = (payload) => ({
  user: payload.user,
  expiresIn: payload.expiresIn,
});

export const authController = {
  signup: asyncHandler(async (req, res) => {
    const data = await authService.signup(req.body, { requestId: req.id || null });
    setSessionCookies(res, data);
    return sendSuccess(res, sanitizedAuthPayload(data), 201);
  }),

  login: asyncHandler(async (req, res) => {
    const data = await authService.login(req.body);
    setSessionCookies(res, data);
    return sendSuccess(res, sanitizedAuthPayload(data));
  }),

  googleAuth: asyncHandler(async (req, res) => {
    const data = await authService.googleAuth(req.body);
    setSessionCookies(res, data);
    return sendSuccess(res, sanitizedAuthPayload(data));
  }),

  forgotPassword: asyncHandler(async (req, res) => {
    const data = await authService.forgotPassword(req.body);
    return sendSuccess(res, data);
  }),

  resetPassword: asyncHandler(async (req, res) => {
    const data = await authService.resetPassword(req.body);
    return sendSuccess(res, data);
  }),

  verifyEmail: asyncHandler(async (req, res) => {
    const data = await authService.verifyEmail(req.body, { requestId: req.id || null });
    return sendSuccess(res, data);
  }),

  resendVerification: asyncHandler(async (req, res) => {
    const data = await authService.resendVerification(
      {
        email: req.body.email,
        userId: req.auth?.sub || null,
      },
      { requestId: req.id || null }
    );
    return sendSuccess(res, data);
  }),

  refresh: asyncHandler(async (req, res) => {
    const data = await authService.refresh({
      refreshToken: req.body.refreshToken || req.cookies?.refreshToken || "",
    });
    setSessionCookies(res, data);
    return sendSuccess(res, { expiresIn: data.expiresIn });
  }),

  logout: asyncHandler(async (_req, res) => {
    clearSessionCookies(res);
    const data = await authService.logout();
    return sendSuccess(res, data);
  }),

  me: asyncHandler(async (req, res) => {
    const data = await authService.me(req.auth.sub);
    return sendSuccess(res, data);
  }),
};
