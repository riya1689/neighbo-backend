import express, { type Router } from "express";
import { register, login, googleAuthCallback } from "./auth.controller.js";
import { authLimiter } from "../../middlewares/rateLimiter.js";
import passport from "passport";

const router: Router = express.Router();

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);

// Google OAuth
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"], session: false }));
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/login", session: false }),
  googleAuthCallback
);

export default router;
