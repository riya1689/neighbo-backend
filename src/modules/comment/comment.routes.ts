import express, { type Router } from "express";
import { getPostComments, createComment } from "./comment.controller.js";
import { protect } from "../../middlewares/authMiddleware.js";

const router: Router = express.Router();

router.get("/:postId", getPostComments);
router.post("/:postId", protect, createComment);

export default router;
