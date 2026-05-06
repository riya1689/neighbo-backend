import type { Request, Response, NextFunction } from "express";
import prisma from "../../config/prisma.js";
import {
  SSL_STORE_ID,
  SSL_STORE_PASS,
  SSL_IS_SANDBOX,
  SSL_SUCCESS_URL,
  SSL_FAIL_URL,
  SSL_CANCEL_URL,
} from "../../config/env.js";

// @ts-ignore – sslcommerz-lts has no type declarations
import SSLCommerzPayment from "sslcommerz-lts";

/* ────────────────────────────────────────────
   INITIATE PAYMENT
   POST /api/payments/initiate
   Body: { type: "PLAN" | "UNLOCK", planId?, postId? }
   ──────────────────────────────────────────── */
export const initiatePayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user.id;
    const { type, planId, postId } = req.body;

    if (!type || !["PLAN", "UNLOCK"].includes(type)) {
      res.status(400).json({ message: "Invalid payment type. Must be PLAN or UNLOCK." });
      return;
    }

    let amount: number;
    let productName: string;
    let tran_id: string;

    if (type === "PLAN") {
      if (!planId) {
        res.status(400).json({ message: "planId is required for plan purchase." });
        return;
      }

      const plan = await prisma.premiumPlan.findUnique({ where: { id: planId } });
      if (!plan) {
        res.status(404).json({ message: "Plan not found." });
        return;
      }

      amount = plan.price;
      productName = plan.name;
      tran_id = `NEIGHBO_PLAN_${Date.now()}_${userId}`;

      // Create pending AdminRevenue record
      await prisma.adminRevenue.create({
        data: {
          userId,
          planType: plan.name,
          amount,
          status: "PENDING",
          tranId: tran_id,
        },
      });
    } else {
      // type === "UNLOCK"
      if (!postId) {
        res.status(400).json({ message: "postId is required for post unlock." });
        return;
      }

      const post = await prisma.post.findUnique({
        where: { id: postId },
        include: { user: { select: { id: true, displayName: true } } },
      });

      if (!post) {
        res.status(404).json({ message: "Post not found." });
        return;
      }

      if (!post.isPremium || !post.unlockPrice) {
        res.status(400).json({ message: "This post is not a paid premium post." });
        return;
      }

      if (post.userId === userId) {
        res.status(400).json({ message: "You cannot pay to unlock your own post." });
        return;
      }

      // Check if already unlocked
      const alreadyUnlocked = await prisma.unlockedPost.findUnique({
        where: { userId_postId: { userId, postId } },
      });
      if (alreadyUnlocked) {
        res.status(400).json({ message: "You have already unlocked this post." });
        return;
      }

      amount = post.unlockPrice;
      productName = `Unlock: ${post.title}`;
      tran_id = `NEIGHBO_UNLOCK_${Date.now()}_${postId}_${userId}`;

      // Create pending CreatorEarning record
      await prisma.creatorEarning.create({
        data: {
          creatorId: post.userId,
          payerId: userId,
          postId,
          amount,
          status: "PENDING",
          tranId: tran_id,
        },
      });
    }

    // Fetch user details for SSLCommerz
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true, email: true, neighborhood: { select: { name: true } } },
    });

    const sslcz = new SSLCommerzPayment(SSL_STORE_ID, SSL_STORE_PASS, SSL_IS_SANDBOX);

    const data = {
      total_amount: amount,
      currency: "BDT",
      tran_id,
      success_url: SSL_SUCCESS_URL,
      fail_url: SSL_FAIL_URL,
      cancel_url: SSL_CANCEL_URL,
      ipn_url: `${SSL_SUCCESS_URL.replace("/success", "/ipn")}`,
      shipping_method: "NO",
      product_name: productName,
      product_category: type === "PLAN" ? "Premium Plan" : "Content Unlock",
      product_profile: "non-physical-goods",
      cus_name: user?.displayName || "Neighbo User",
      cus_email: user?.email || "user@neighbo.com",
      cus_add1: user?.neighborhood?.name || "Neighbo Community",
      cus_city: "Dhaka",
      cus_country: "Bangladesh",
      cus_phone: "N/A",
    };

    const apiResponse = await sslcz.init(data);

    if (apiResponse?.GatewayPageURL) {
      res.json({ url: apiResponse.GatewayPageURL, tran_id });
    } else {
      res.status(500).json({ message: "Failed to initialize payment gateway." });
    }
  } catch (error) {
    next(error);
  }
};

/* ────────────────────────────────────────────
   SUCCESS CALLBACK (IPN from SSLCommerz)
   POST /api/payments/success
   ──────────────────────────────────────────── */
export const paymentSuccess = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { tran_id, val_id, bank_tran_id, card_type } = req.body;

    if (!tran_id) {
      res.status(400).json({ message: "Missing transaction ID." });
      return;
    }

    // Validate with SSLCommerz
    const sslcz = new SSLCommerzPayment(SSL_STORE_ID, SSL_STORE_PASS, SSL_IS_SANDBOX);
    const validation = await sslcz.validate({ val_id });

    if (validation?.status !== "VALID" && validation?.status !== "VALIDATED") {
      // Mark as failed
      if (tran_id.startsWith("NEIGHBO_PLAN_")) {
        await prisma.adminRevenue.updateMany({
          where: { tranId: tran_id },
          data: { status: "FAILED" },
        });
      } else {
        await prisma.creatorEarning.updateMany({
          where: { tranId: tran_id },
          data: { status: "FAILED" },
        });
      }
      res.redirect(`http://localhost:3000/payment/fail?tran_id=${tran_id}`);
      return;
    }

    const ssl_tran_id = bank_tran_id || val_id;

    if (tran_id.startsWith("NEIGHBO_PLAN_")) {
      // ──── PREMIUM PLAN PURCHASE ────
      const revenue = await prisma.adminRevenue.findUnique({ where: { tranId: tran_id } });
      if (!revenue || revenue.status === "COMPLETED") {
        res.redirect(`http://localhost:3000/payment/success?tran_id=${tran_id}`);
        return;
      }

      // Determine plan duration from planType name
      const plan = await prisma.premiumPlan.findFirst({
        where: { name: revenue.planType },
      });

      const durationDays = plan?.duration || 90;
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + durationDays);

      // Determine PlanType enum
      let planTypeEnum: "THREE_MONTHS" | "SIX_MONTHS" | "ONE_YEAR" = "THREE_MONTHS";
      if (durationDays > 300) planTypeEnum = "ONE_YEAR";
      else if (durationDays > 100) planTypeEnum = "SIX_MONTHS";

      // Calculate purchaseNo
      const purchaseNo = await prisma.subscription.count({
        where: { userId: revenue.userId },
      });

      await prisma.$transaction([
        prisma.adminRevenue.update({
          where: { tranId: tran_id },
          data: {
            status: "COMPLETED",
            sslTranId: ssl_tran_id,
            paidAt: new Date(),
          },
        }),
        prisma.subscription.create({
          data: {
            userId: revenue.userId,
            planType: planTypeEnum,
            startDate,
            endDate,
            isActive: true,
          },
        }),
      ]);

      res.redirect(`http://localhost:3000/payment/success?tran_id=${tran_id}`);
    } else if (tran_id.startsWith("NEIGHBO_UNLOCK_")) {
      // ──── POST UNLOCK ────
      const earning = await prisma.creatorEarning.findUnique({ where: { tranId: tran_id } });
      if (!earning || earning.status === "COMPLETED") {
        res.redirect(`http://localhost:3000/payment/success?tran_id=${tran_id}`);
        return;
      }

      await prisma.$transaction([
        prisma.creatorEarning.update({
          where: { tranId: tran_id },
          data: {
            status: "COMPLETED",
            sslTranId: ssl_tran_id,
            paidAt: new Date(),
          },
        }),
        prisma.unlockedPost.create({
          data: {
            userId: earning.payerId,
            postId: earning.postId,
          },
        }),
        prisma.notification.create({
          data: {
            userId: earning.creatorId,
            type: "PAYMENT",
            message: `Someone unlocked your premium post! You earned ৳${earning.amount} BDT.`,
            link: `/payment/success?tran_id=${tran_id}`,
          },
        }),
      ]);

      res.redirect(`http://localhost:3000/payment/success?tran_id=${tran_id}`);
    } else {
      res.redirect(`http://localhost:3000/payment/fail?tran_id=${tran_id}`);
    }
  } catch (error) {
    next(error);
  }
};

/* ────────────────────────────────────────────
   FAIL CALLBACK
   POST /api/payments/fail
   ──────────────────────────────────────────── */
export const paymentFail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { tran_id } = req.body;

    if (tran_id) {
      if (tran_id.startsWith("NEIGHBO_PLAN_")) {
        await prisma.adminRevenue.updateMany({
          where: { tranId: tran_id, status: "PENDING" },
          data: { status: "FAILED" },
        });
      } else if (tran_id.startsWith("NEIGHBO_UNLOCK_")) {
        await prisma.creatorEarning.updateMany({
          where: { tranId: tran_id, status: "PENDING" },
          data: { status: "FAILED" },
        });
      }
    }

    res.redirect(`http://localhost:3000/payment/fail?tran_id=${tran_id || ""}`);
  } catch (error) {
    next(error);
  }
};

/* ────────────────────────────────────────────
   CANCEL CALLBACK
   POST /api/payments/cancel
   ──────────────────────────────────────────── */
export const paymentCancel = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { tran_id } = req.body;

    if (tran_id) {
      if (tran_id.startsWith("NEIGHBO_PLAN_")) {
        await prisma.adminRevenue.updateMany({
          where: { tranId: tran_id, status: "PENDING" },
          data: { status: "FAILED" },
        });
      } else if (tran_id.startsWith("NEIGHBO_UNLOCK_")) {
        await prisma.creatorEarning.updateMany({
          where: { tranId: tran_id, status: "PENDING" },
          data: { status: "FAILED" },
        });
      }
    }

    res.redirect(`http://localhost:3000/payment/cancel`);
  } catch (error) {
    next(error);
  }
};

/* ────────────────────────────────────────────
   VERIFY TRANSACTION (user-scoped)
   GET /api/payments/verify/:tranId
   ──────────────────────────────────────────── */
export const verifyTransaction = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { tranId } = req.params;
    const userId = req.user.id;

    if (tranId.startsWith("NEIGHBO_PLAN_")) {
      const revenue = await prisma.adminRevenue.findUnique({
        where: { tranId },
        include: {
          user: {
            select: {
              displayName: true,
              username: true,
              email: true,
              neighborhood: { select: { name: true } },
            },
          },
        },
      });

      if (!revenue) {
        res.status(404).json({ message: "Transaction not found." });
        return;
      }

      // Ownership check
      if (revenue.userId !== userId) {
        res.status(403).json({ message: "You do not have access to this transaction." });
        return;
      }

      // Calculate purchaseNo
      const purchaseNo = await prisma.subscription.count({
        where: { userId: revenue.userId },
      });

      res.json({
        type: "PLAN",
        tranId: revenue.tranId,
        sslTranId: revenue.sslTranId,
        planType: revenue.planType,
        amount: revenue.amount,
        status: revenue.status,
        paidAt: revenue.paidAt,
        createdAt: revenue.createdAt,
        purchaseNo,
        buyer: {
          displayName: revenue.user.displayName,
          username: revenue.user.username,
          email: revenue.user.email,
          neighborhood: revenue.user.neighborhood?.name || "N/A",
        },
      });
    } else if (tranId.startsWith("NEIGHBO_UNLOCK_")) {
      const earning = await prisma.creatorEarning.findUnique({
        where: { tranId },
        include: {
          payer: {
            select: {
              displayName: true,
              username: true,
              email: true,
              neighborhood: { select: { name: true } },
            },
          },
          creator: {
            select: { displayName: true, username: true },
          },
          post: {
            select: { title: true },
          },
        },
      });

      if (!earning) {
        res.status(404).json({ message: "Transaction not found." });
        return;
      }

      // Ownership check — payer or creator can view
      if (earning.payerId !== userId && earning.creatorId !== userId) {
        res.status(403).json({ message: "You do not have access to this transaction." });
        return;
      }

      res.json({
        type: "UNLOCK",
        tranId: earning.tranId,
        sslTranId: earning.sslTranId,
        postTitle: earning.post.title,
        amount: earning.amount,
        status: earning.status,
        paidAt: earning.paidAt,
        createdAt: earning.createdAt,
        buyer: {
          displayName: earning.payer.displayName,
          username: earning.payer.username,
          email: earning.payer.email,
          neighborhood: earning.payer.neighborhood?.name || "N/A",
        },
        creator: {
          displayName: earning.creator.displayName,
          username: earning.creator.username,
        },
      });
    } else {
      res.status(400).json({ message: "Invalid transaction ID format." });
    }
  } catch (error) {
    next(error);
  }
};
