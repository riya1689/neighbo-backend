import type { Request, Response } from "express";
import { getAIResponse } from "../../services/geminiServices.js";

/**
 * Handles chat messages from users
 */
export const chatController = async (req: Request, res: Response) => {
  try {
    const { userMessage, history } = req.body;
    console.log("AI Chat Request:", { userMessage, historyLength: history?.length });

    if (!userMessage) {
      return res.status(400).json({
        status: "error",
        message: "userMessage is required",
      });
    }

    const reply = await getAIResponse(userMessage, history || []);

    res.json({
      status: "success",
      reply,
    });
  } catch (error) {
    console.error("Error in chatController:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to get AI response",
    });
  }
};