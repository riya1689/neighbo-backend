import express, { type Router } from "express";
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead } from "./notification.controller.js";
import { protect } from "../../middlewares/authMiddleware.js";

const router: Router = express.Router();

router.get("/", protect, getNotifications);
router.get("/unread-count", protect, getUnreadCount);
router.patch("/:id/read", protect, markAsRead);
router.patch("/read-all", protect, markAllAsRead);

export default router;
