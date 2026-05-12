import express from "express";
import { chatController } from "./ai.controller.js";
import { protect } from "../../middlewares/authMiddleware.js";

const router = express.Router();

/**
 * @route POST /api/ai/chat
 * @desc Send a message to Neighbo AI
 * @access Private
 */
router.post("/chat", protect, chatController);

export default router;
