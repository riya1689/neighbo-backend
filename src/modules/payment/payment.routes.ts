import express, { type Router } from "express";
import {
  initiatePayment,
  paymentSuccess,
  paymentFail,
  paymentCancel,
  verifyTransaction,
} from "./payment.controller.js";
import { protect } from "../../middlewares/authMiddleware.js";

const router: Router = express.Router();

// Authenticated routes
router.post("/initiate", protect, initiatePayment);
router.get("/verify/:tranId", protect, verifyTransaction);

// SSLCommerz callback routes (no auth — called by SSLCommerz server)
router.post("/success", paymentSuccess);
router.post("/fail", paymentFail);
router.post("/cancel", paymentCancel);
router.post("/ipn", paymentSuccess); // IPN uses same handler as success

export default router;
