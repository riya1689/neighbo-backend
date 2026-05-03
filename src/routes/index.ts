import express, { type Router } from "express"; // TS Change: Imported Router type

import healthRoutes from "./health.routes.js";
import authRoutes from "../modules/auth/auth.routes.js";
import userRoutes from "../modules/user/user.routes.js";
import neighborhoodRoutes from "../modules/neighborhood/neighborhood.routes.js";
import adminRoutes from "../modules/admin/admin.routes.js";
import postRoutes from "../modules/post/post.routes.js";
import categoryRoutes from "../modules/category/category.routes.js";

const router: Router = express.Router(); // TS Change: Explicitly typed as Router

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/neighborhoods", neighborhoodRoutes);
router.use("/admin", adminRoutes);
router.use("/posts", postRoutes);
router.use("/categories", categoryRoutes);

export default router;