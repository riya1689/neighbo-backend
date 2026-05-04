import express, { type Router } from "express";
import { createPost, getAllPosts, logImpressions, getAlgorithmicFeed } from "./post.controller.js";
import { protect } from "../../middlewares/authMiddleware.js";

const router: Router = express.Router();

router.get("/", getAllPosts);
router.post("/", protect, createPost);
router.post("/impressions", protect, logImpressions);
router.get("/feed", protect, getAlgorithmicFeed);

export default router;
