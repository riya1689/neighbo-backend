import express, { type Router } from "express";
import { 
  getStats, 
  getUsers, 
  updateUserStatus, 
  getCategories, 
  createCategory, 
  deleteCategory,
  getNeighborhoods,
  createNeighborhood,
  deleteNeighborhood,
  getPlans,
  createPlan,
  deletePlan,
  getPayments
} from "./admin.controller.js";
import { protect, restrictTo } from "../../middlewares/authMiddleware.js";

const router: Router = express.Router();

// All admin routes are protected and restricted to ADMIN role
router.use(protect);
router.use(restrictTo("ADMIN"));

router.get("/stats", getStats);

router.get("/users", getUsers);
router.patch("/users/:id/status", updateUserStatus);

router.get("/categories", getCategories);
router.post("/categories", createCategory);
router.delete("/categories/:id", deleteCategory);

router.get("/neighborhoods", getNeighborhoods);
router.post("/neighborhoods", createNeighborhood);
router.delete("/neighborhoods/:id", deleteNeighborhood);

router.get("/plans", getPlans);
router.post("/plans", createPlan);
router.delete("/plans/:id", deletePlan);

router.get("/payments", getPayments);

export default router;
