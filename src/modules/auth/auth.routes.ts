import express, { type Router } from "express";
import { register, login } from "./auth.controller.js";
import { authLimiter } from "../../middlewares/rateLimiter.js";

const router: Router = express.Router();

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);

export default router;
