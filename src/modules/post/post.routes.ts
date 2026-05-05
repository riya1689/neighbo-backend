import { Router } from "express";
import { createPost, getAllPosts, logImpressions, getAlgorithmicFeed, searchPosts, sharePost } from "./post.controller.js";
import { protect } from "../../middlewares/authMiddleware.js";

const router = Router();

router.get("/", getAllPosts);
router.get("/search", searchPosts);
router.post("/", protect, createPost);
router.post("/impressions", protect, logImpressions);
router.get("/feed", protect, getAlgorithmicFeed);
router.post("/:postId/share", protect, sharePost);

export default router;
