import express, { type Router } from "express";
import { 
  getUserProfile, 
  toggleFollow, 
  getSuggestedUsers, 
  getFollowers, 
  getFollowing, 
  getConnectionStats,
  getPublicProfile,
  getPublicProfilePosts,
  updateProfile,
  updatePassword
} from "./user.controller.js";
import { protect } from "../../middlewares/authMiddleware.js";

const router: Router = express.Router();

router.get("/profile", protect, getUserProfile);
router.patch("/profile", protect, updateProfile);
router.patch("/password", protect, updatePassword);
router.post("/:id/follow", protect, toggleFollow);
router.get("/suggested", protect, getSuggestedUsers);
router.get("/followers", protect, getFollowers);
router.get("/following", protect, getFollowing);
router.get("/stats", protect, getConnectionStats);

// Public routes
router.get("/profile/public/:username", getPublicProfile);
router.get("/profile/public/:username/posts", getPublicProfilePosts);

export default router;
