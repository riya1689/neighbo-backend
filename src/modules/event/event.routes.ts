import express, { type Router } from "express";
import { protect, restrictTo } from "../../middlewares/authMiddleware.js";
import {
  createEvent,
  getUserEvents,
  getAdminEvents,
  updateEventStatus,
  updateEventTitle,
  deleteEvent,
  getApprovedEvents
} from "./event.controller.js";

const router: Router = express.Router();

// Public routes
router.get("/approved", getApprovedEvents);

// User routes
router.post("/", protect, createEvent);
router.get("/my-events", protect, getUserEvents);
router.patch("/:id/title", protect, updateEventTitle);
router.delete("/:id", protect, deleteEvent);

// Admin routes
router.get("/admin/all", protect, restrictTo("ADMIN"), getAdminEvents);
router.patch("/admin/:id/status", protect, restrictTo("ADMIN"), updateEventStatus);

export default router;
