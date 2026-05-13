import express from "express";
import { protect, restrictTo } from "../../middlewares/authMiddleware.js";
import {
  createUpdate,
  getUpdates,
  updateUpdate,
  deleteUpdate
} from "./update.controller.js";

const router = express.Router();

// Public routes
router.get("/", getUpdates);

// Private Admin routes
router.post("/", protect, restrictTo("ADMIN"), createUpdate);
router.patch("/:id", protect, restrictTo("ADMIN"), updateUpdate);
router.delete("/:id", protect, restrictTo("ADMIN"), deleteUpdate);

export default router;
