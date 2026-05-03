import express, { type Router } from "express"; // TS Change: Imported Router type

import healthRoutes from "./health.routes.js"; // TS Change: Removed .js extensions
// import authRoutes from "../modules/auth/auth.routes";
// import userRoutes from "../modules/user/user.routes";
// import postRoutes from "../modules/post/post.routes";
// import commentRoutes from "../modules/comment/comment.routes";
// import followRoutes from "../modules/follow/follow.routes";
// import voteRoutes from "../modules/vote/vote.routes";
// import notificationRoutes from "../modules/notification/notification.routes";
// import paymentRoutes from "../modules/payment/payment.routes";
// import searchRoutes from "../modules/search/search.routes";
// import adminRoutes from "../modules/admin/admin.routes";

const router: Router = express.Router(); // TS Change: Explicitly typed as Router

router.use("/health", healthRoutes);
// router.use("/auth", authRoutes);
// router.use("/users", userRoutes);
// router.use("/users", followRoutes);
// router.use("/posts", postRoutes);
// router.use("/posts", commentRoutes);
// router.use("/posts", voteRoutes);
// router.use("/notifications", notificationRoutes);
// router.use("/payments", paymentRoutes);
// router.use("/search", searchRoutes);
// router.use("/admin", adminRoutes);

export default router;