import express, { type Router } from "express";
import { createPost, getAllPosts, logImpressions, getAlgorithmicFeed, searchPosts, sharePost, getTrendingPosts, updatePost, deletePost } from "./post.controller.js";
import { protect } from "../../middlewares/authMiddleware.js";

const router: Router = express.Router();

router.get("/", getAllPosts);
router.get("/trending", getTrendingPosts);
router.get("/search", searchPosts);
router.post("/", protect, createPost);
router.post("/impressions", protect, logImpressions);
router.get("/feed", protect, getAlgorithmicFeed);
router.post("/:postId/share", protect, sharePost);
router.patch("/:id", protect, updatePost);
router.delete("/:id", protect, deletePost);

export default router;
