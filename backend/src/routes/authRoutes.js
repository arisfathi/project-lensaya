import { Router } from "express";
import { authController } from "../controllers/authController.js";
import { validate } from "../middleware/validate.js";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimit.js";
import {
  emptySchema,
  emptyQuerySchema,
  signupSchema,
  loginSchema,
  googleSchema,
  forgotSchema,
  resetSchema,
  refreshSchema,
  verifyEmailSchema,
  resendVerificationSchema,
} from "../utils/validationSchemas.js";

const router = Router();

router.post("/auth/signup", authLimiter, validate(signupSchema), authController.signup);
router.post("/auth/login", authLimiter, validate(loginSchema), authController.login);
router.post("/auth/google", authLimiter, validate(googleSchema), authController.googleAuth);
router.post("/auth/forgot-password", validate(forgotSchema), authController.forgotPassword);
router.post("/auth/reset-password", validate(resetSchema), authController.resetPassword);
router.post("/auth/verify-email", authLimiter, validate(verifyEmailSchema), authController.verifyEmail);
router.post("/auth/resend-verification", authLimiter, optionalAuth, validate(resendVerificationSchema), authController.resendVerification);
router.post("/auth/refresh", validate(refreshSchema), authController.refresh);
router.post("/auth/logout", requireAuth, validate(emptySchema), authController.logout);
router.get("/auth/me", requireAuth, validate(emptyQuerySchema, "query"), authController.me);

export default router;
