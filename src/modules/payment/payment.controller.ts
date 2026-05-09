import { type Request, type Response, type NextFunction } from "express";
import prisma from "../../config/prisma.js";
import {
  SSL_STORE_ID,
  SSL_STORE_PASS,
  SSL_IS_SANDBOX,
  SSL_SUCCESS_URL,
  SSL_FAIL_URL,
  SSL_CANCEL_URL,
  FRONTEND_URL,
} from "../../config/env.js";

// @ts-ignore – sslcommerz-lts has no type declarations
import SSLCommerzPayment from "sslcommerz-lts";

export const initiatePayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user.id;
    const { type, planId, postId } = req.body;

    // 1. Validate Input
    if (!type || !["PLAN", "UNLOCK"].includes(type)) {
      res.status(400).json({ message: "Invalid payment type." });
      return;
    }

    let amount: number;
    let productName: string;
    let tran_id: string;

    const shortId = userId.slice(-6); // Last 6 chars of User ID
    const timestamp = Date.now().toString().slice(-8); // Last 8 digits of timestamp

    // 2. Fetch Item Data
    if (type === "PLAN") {
      const plan = await prisma.premiumPlan.findUnique({ where: { id: planId } });
      if (!plan) { res.status(404).json({ message: "Plan not found." }); return; }
      amount = plan.price;
      productName = plan.name;
      tran_id = `P_${timestamp}_${shortId}`;
      await prisma.adminRevenue.create({ data: { userId, planType: plan.name, amount, status: "PENDING", tranId: tran_id } });
    } else {
      const post = await prisma.post.findUnique({ where: { id: postId } });
      if (!post || !post.unlockPrice) { res.status(404).json({ message: "Post not found." }); return; }
      amount = post.unlockPrice;
      productName = `Unlock: ${post.title}`;
      tran_id = `U_${timestamp}_${shortId}`;
      await prisma.creatorEarning.create({ data: { creatorId: post.userId, payerId: userId, postId, amount, status: "PENDING", tranId: tran_id } });
    }

    // 3. Fetch User Data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true, email: true, neighborhood: { select: { name: true } } },
    });

    // 4. Initialize SSLCommerz
    const sslcz = new SSLCommerzPayment(SSL_STORE_ID, SSL_STORE_PASS, SSL_IS_SANDBOX);

    // 🛡️ SECURITY: Detect if we are on Vercel and check URLs
    if (process.env.NODE_ENV === 'production' && SSL_SUCCESS_URL.includes('localhost')) {
      console.error("🚨 ERROR: Using localhost URL in production! Check Vercel Environment Variables.");
    }

    const data = {
      total_amount: amount,
      currency: "BDT",
      tran_id: tran_id,
      success_url: SSL_SUCCESS_URL,
      fail_url: SSL_FAIL_URL,
      cancel_url: SSL_CANCEL_URL,
      ipn_url: `${SSL_SUCCESS_URL.replace("/success", "/ipn")}`,
      shipping_method: "NO",
      product_name: productName.slice(0, 50),
      product_category: "DigitalService",
      product_profile: "non-physical-goods",
      cus_name: user?.displayName || "Neighbo User",
      cus_email: user?.email || "user@neighbo.com",
      cus_add1: user?.neighborhood?.name || "Dhaka",
      cus_city: "Dhaka",
      cus_country: "Bangladesh",
      cus_phone: "01700000000", // Required field
    };

    console.log("Initializing SSL with:", { storeId: SSL_STORE_ID, isSandbox: SSL_IS_SANDBOX, successUrl: SSL_SUCCESS_URL });

    const apiResponse = await sslcz.init(data);

    if (apiResponse?.GatewayPageURL) {
      res.json({ url: apiResponse.GatewayPageURL, tran_id });
    } else {
      console.error("SSLCommerz Init Failed Response:", apiResponse);
      res.status(400).json({
        message: "Payment gateway initialization failed.",
        reason: apiResponse?.failedreason || "Configuration error",
        debug: SSL_IS_SANDBOX ? "Check if Store ID matches Sandbox mode." : undefined
      });
    }
  } catch (error: any) {
    console.error(`Payment initiation error:`, error);
    res.status(500).json({ message: "Internal server error." });
  }
};

export const paymentSuccess = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { tran_id, val_id } = req.body;
    const sslcz = new SSLCommerzPayment(SSL_STORE_ID, SSL_STORE_PASS, SSL_IS_SANDBOX);
    const validationResponse = await sslcz.validate({ val_id });

    if (validationResponse.status !== "VALID" && validationResponse.status !== "VALIDATED") {
      res.redirect(`${FRONTEND_URL}/payment/fail?tran_id=${tran_id}`);
      return;
    }

    const ssl_tran_id = validationResponse.bank_tran_id || val_id;

    if (tran_id.startsWith("NEIGHBO_PLAN_")) {
      const revenue = await prisma.adminRevenue.findUnique({ where: { tranId: tran_id } });
      if (!revenue || revenue.status === "COMPLETED") {
        res.redirect(`${FRONTEND_URL}/payment/success?tran_id=${tran_id}`);
        return;
      }
      const plan = await prisma.premiumPlan.findFirst({ where: { name: revenue.planType } });
      const duration = plan?.duration || 30;
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + duration);

      await prisma.$transaction([
        prisma.adminRevenue.update({ where: { tranId: tran_id }, data: { status: "COMPLETED", sslTranId: ssl_tran_id, paidAt: new Date() } }),
        prisma.subscription.create({ data: { userId: revenue.userId, planType: (plan?.name as any) || "THREE_MONTHS", startDate: new Date(), endDate, isActive: true } }),
        prisma.user.update({ where: { id: revenue.userId }, data: { status: "PREMIUM" } }),
      ]);
    } else {
      const earning = await prisma.creatorEarning.findUnique({ where: { tranId: tran_id } });
      if (earning && earning.status !== "COMPLETED") {
        await prisma.$transaction([
          prisma.creatorEarning.update({ where: { tranId: tran_id }, data: { status: "COMPLETED", sslTranId: ssl_tran_id, paidAt: new Date() } }),
          prisma.unlockedPost.create({ data: { userId: earning.payerId, postId: earning.postId } }),
        ]);
      }
    }
    res.redirect(`${FRONTEND_URL}/payment/success?tran_id=${tran_id}`);
  } catch (error) { next(error); }
};

export const paymentFail = async (req: Request, res: Response) => {
  res.redirect(`${FRONTEND_URL}/payment/fail?tran_id=${req.body.tran_id || ""}`);
};

export const paymentCancel = async (req: Request, res: Response) => {
  res.redirect(`${FRONTEND_URL}/payment/cancel`);
};

export const verifyTransaction = async (req: Request, res: Response) => {
  try {
    const { tranId } = req.params;
    let transaction: any;

    if (tranId.startsWith("P_")) {
      transaction = await prisma.adminRevenue.findUnique({
        where: { tranId },
        include: { user: { select: { displayName: true, email: true, username: true, neighborhood: { select: { name: true } } } } },
      });
    } else {
      transaction = await prisma.creatorEarning.findUnique({
        where: { tranId },
        include: { 
          payer: { select: { displayName: true, email: true, username: true, neighborhood: { select: { name: true } } } },
          post: { select: { title: true } }
        },
      });
    }

    if (!transaction) {
      res.status(404).json({ message: "Transaction not found." });
      return;
    }

    // Normalize user/buyer data for the frontend
    const responseData = {
      ...transaction,
      buyer: transaction.user || transaction.payer,
    };

    res.json(responseData);
  } catch (error) {
    console.error("Verification error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

