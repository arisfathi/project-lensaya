import { Router } from "express";
import authRoutes from "./authRoutes.js";
import publicRoutes from "./publicRoutes.js";
import profileRoutes from "./profileRoutes.js";
import dashboardRoutes from "./dashboardRoutes.js";
import portfolioRoutes from "./portfolioRoutes.js";
import uploadRoutes from "./uploadRoutes.js";
import userRoutes from "./userRoutes.js";
import adminRoutes from "./adminRoutes.js";
import billingRoutes from "./billingRoutes.js";
import bookingRoutes from "./bookingRoutes.js";
import servicesRoutes from "./servicesRoutes.js";
import packagesRoutes from "./packagesRoutes.js";
import availabilityRoutes from "./availabilityRoutes.js";
import analyticsRoutes from "./analyticsRoutes.js";
import referralRoutes from "./referralRoutes.js";

const router = Router();

router.use(authRoutes);
router.use(publicRoutes);
router.use(billingRoutes);
router.use(profileRoutes);
router.use(dashboardRoutes);
router.use(portfolioRoutes);
router.use(uploadRoutes);
router.use(bookingRoutes);
router.use(servicesRoutes);
router.use(packagesRoutes);
router.use(availabilityRoutes);
router.use(analyticsRoutes);
router.use(referralRoutes);
router.use(userRoutes);
router.use(adminRoutes);

export default router;
