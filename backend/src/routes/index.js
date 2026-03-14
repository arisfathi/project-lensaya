import { Router } from "express";
import authRoutes from "./authRoutes.js";
import publicRoutes from "./publicRoutes.js";
import userRoutes from "./userRoutes.js";
import adminRoutes from "./adminRoutes.js";
import billingRoutes from "./billingRoutes.js";
import bookingRoutes from "./bookingRoutes.js";
import servicesRoutes from "./servicesRoutes.js";

const router = Router();

router.use(authRoutes);
router.use(publicRoutes);
router.use(billingRoutes);
router.use(bookingRoutes);
router.use(servicesRoutes);
router.use(userRoutes);
router.use(adminRoutes);

export default router;
