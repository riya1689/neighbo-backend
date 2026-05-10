import express, { type Router } from "express";
import { 
  getStats, 
  getTransactions, 
  getPosts, 
  getPurchases, 
  getPremiumPlans 
} from "./dashboard.controller.js";
import { protect } from "../../middlewares/authMiddleware.js";

const router: Router = express.Router();

router.get("/stats", protect, getStats);
router.get("/transactions", protect, getTransactions);
router.get("/posts", protect, getPosts);
router.get("/purchases", protect, getPurchases);
router.get("/plans", protect, getPremiumPlans);

export default router;
