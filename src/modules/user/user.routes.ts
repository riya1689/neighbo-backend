import express, { type Router } from "express";
import { getUserProfile } from "./user.controller.js";
import { protect } from "../../middlewares/authMiddleware.js";

const router: Router = express.Router();

router.get("/profile", protect, getUserProfile);

export default router;
