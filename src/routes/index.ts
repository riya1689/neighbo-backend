import express, { type Router } from "express"; // TS Change: Imported Router type

import healthRoutes from "./health.routes.js";
import authRoutes from "../modules/auth/auth.routes.js";
import userRoutes from "../modules/user/user.routes.js";
import neighborhoodRoutes from "../modules/neighborhood/neighborhood.routes.js";
import adminRoutes from "../modules/admin/admin.routes.js";
import postRoutes from "../modules/post/post.routes.js";
import categoryRoutes from "../modules/category/category.routes.js";
import planRoutes from "../modules/plan/plan.routes.js";
import voteRoutes from "../modules/vote/vote.routes.js";
import commentRoutes from "../modules/comment/comment.routes.js";
import notificationRoutes from "../modules/notification/notification.routes.js";
import paymentRoutes from "../modules/payment/payment.routes.js";
import dashboardRoutes from "../modules/dashboard/dashboard.routes.js";
import aiRoutes from "../modules/ai/ai.routes.js";

const router: Router = express.Router(); // TS Change: Explicitly typed as Router

// Root route for /api
router.get("/", (req, res) => {
  res.json({
    status: "success",
    message: "Welcome to Neighbo API",
    version: "1.0.0"
  });
});


router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/neighborhoods", neighborhoodRoutes);
router.use("/admin", adminRoutes);
router.use("/posts", postRoutes);
router.use("/categories", categoryRoutes);
router.use("/plans", planRoutes);
router.use("/votes", voteRoutes);
router.use("/comments", commentRoutes);
router.use("/notifications", notificationRoutes);
router.use("/payments", paymentRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/ai", aiRoutes);

export default router;