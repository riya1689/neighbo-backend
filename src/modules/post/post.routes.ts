import express, { type Router } from "express";
import { createPost, getAllPosts } from "./post.controller.js";
import { protect } from "../../middlewares/authMiddleware.js";

const router: Router = express.Router();

router.get("/", getAllPosts);
router.post("/", protect, createPost);

export default router;
