import { Router } from "express";
import { authController } from "../controllers/authController.js";
import { photographerController } from "../controllers/photographerController.js";
import { notificationController } from "../controllers/notificationController.js";
import { uploadController } from "../controllers/uploadController.js";
import { userController } from "../controllers/userController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

router.get("/users/me", authController.me);
router.patch("/users/profile", photographerController.updateProfile);
router.post("/users/change-password", userController.changePassword);
router.delete("/users/account", userController.deleteAccount);
router.get("/users/notifications", notificationController.list);
router.patch("/users/notifications/read", notificationController.readPost);
router.post("/users/avatar", uploadController.setAvatar);
router.delete("/users/avatar", uploadController.clearAvatar);

export default router;

