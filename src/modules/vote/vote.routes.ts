import express, { type Router } from "express";
import { handleVote } from "./vote.controller.js";
import { protect } from "../../middlewares/authMiddleware.js";

const router: Router = express.Router();

router.post("/:postId", protect, handleVote);

export default router;
