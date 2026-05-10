import express, { type Router } from "express";
import { getStats, getTransactions, getPosts } from "./dashboard.controller.js";
import { protect } from "../../middlewares/authMiddleware.js";

const router: Router = express.Router();

router.get("/stats", protect, getStats);
router.get("/transactions", protect, getTransactions);
router.get("/posts", protect, getPosts);

export default router;
