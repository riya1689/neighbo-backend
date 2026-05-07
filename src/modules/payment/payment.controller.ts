import type { Request, Response, NextFunction } from "express";
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

/**
 * @desc    Initiate SSLCommerz payment session
 * @route   POST /api/payments/initiate
 * @access  Private (Auth)
 */
export const initiatePayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user.id;
    const { type, planId, postId } = req.body;

    console.log(`Payment initiation started: type=${type}, planId=${planId}, postId=${postId}, userId=${userId}`);

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
        console.error(`Plan not found: ${planId}`);
        res.status(404).json({ message: "Plan not found." });
        return;
      }

      amount = plan.price;
      productName = plan.name;
      tran_id = `NEIGHBO_PLAN_${Date.now()}_${userId}`;

      console.log(`Creating AdminRevenue record for plan: ${productName}, amount: ${amount}`);
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
        console.error(`Post not found: ${postId}`);
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

      console.log(`Creating CreatorEarning record for post: ${post.title}, amount: ${amount}`);
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

    console.log(`Initializing SSLCommerz with storeId=${SSL_STORE_ID}, sandbox=${SSL_IS_SANDBOX}`);
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
      cus_phone: "01700000000",
    };

    console.log(`Calling SSLCommerz init with data:`, JSON.stringify(data, null, 2));
    const apiResponse = await sslcz.init(data);
    console.log(`SSLCommerz response:`, JSON.stringify(apiResponse, null, 2));

    if (apiResponse?.GatewayPageURL) {
      res.json({ url: apiResponse.GatewayPageURL, tran_id });
    } else if (apiResponse?.status === "FAILED") {
      console.error(`SSLCommerz initialization failed: ${apiResponse.failedreason}`);
      res.status(400).json({ 
        message: "Payment gateway initialization failed.", 
        reason: apiResponse.failedreason 
      });
    } else {
      console.error(`SSLCommerz init returned unknown response:`, apiResponse);
      res.status(500).json({ message: "Failed to initialize payment gateway." });
    }
  } catch (error: any) {
    console.error(`Payment initiation error:`, error);
    res.status(500).json({ message: "Internal server error during payment initiation.", error: error.message });
  }
};

/**
 * @desc    SSLCommerz Success Callback (IPN or Redirect)
 * @route   POST /api/payments/success
 */
export const paymentSuccess = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { tran_id, status, bank_tran_id, val_id, amount, card_type, store_amount } = req.body ;

    console.log(`Payment success callback for tran_id: ${tran_id}, status: ${status}`);

    if (status !== "VALID" && status !== "VALIDATED") {
      // If it's not a success status from SSLCommerz
      if (tran_id.startsWith("NEIGHBO_PLAN_")) {
        await prisma.adminRevenue.update({
          where: { tranId: tran_id },
          data: { status: "FAILED" },
        });
      } else if (tran_id.startsWith("NEIGHBO_UNLOCK_")) {
        await prisma.creatorEarning.update({
          where: { tranId: tran_id },
          data: { status: "FAILED" },
        });
      }
      res.redirect(`${FRONTEND_URL}/payment/fail?tran_id=${tran_id}`);
      return;
    }

    const ssl_tran_id = bank_tran_id || val_id;

    if (tran_id.startsWith("NEIGHBO_PLAN_")) {
      // ──── PREMIUM PLAN PURCHASE ────
      const revenue = await prisma.adminRevenue.findUnique({ where: { tranId: tran_id } });
      if (!revenue || revenue.status === "COMPLETED") {
        res.redirect(`${FRONTEND_URL}/payment/success?tran_id=${tran_id}`);
        return;
      }

      const plan = await prisma.premiumPlan.findFirst({ where: { name: revenue.planType } });
      const duration = plan?.duration || 30;

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(startDate.getDate() + duration);

      // Atomic update: Mark revenue COMPLETED, Create Subscription, Update User Status
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
            planType: (plan?.name as any) || "THREE_MONTHS",
            startDate,
            endDate,
            isActive: true,
          },
        }),
        prisma.user.update({
          where: { id: revenue.userId },
          data: { status: "PREMIUM" },
        }),
        prisma.notification.create({
          data: {
            userId: revenue.userId,
            type: "PAYMENT",
            message: `Your ${revenue.planType} is now active until ${endDate.toLocaleDateString()}.`,
          },
        }),
      ]);

      res.redirect(`${FRONTEND_URL}/payment/success?tran_id=${tran_id}`);
    } else if (tran_id.startsWith("NEIGHBO_UNLOCK_")) {
      // ──── POST UNLOCK ────
      const earning = await prisma.creatorEarning.findUnique({ where: { tranId: tran_id } });
      if (!earning || earning.status === "COMPLETED") {
        res.redirect(`${FRONTEND_URL}/payment/success?tran_id=${tran_id}`);
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
            message: `Someone unlocked your premium post for ৳${earning.amount}.`,
          },
        }),
      ]);

      res.redirect(`${FRONTEND_URL}/payment/success?tran_id=${tran_id}`);
    } else {
      res.redirect(`${FRONTEND_URL}/payment/fail?tran_id=${tran_id}`);
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    SSLCommerz Fail Callback
 */
export const paymentFail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { tran_id } = req.body;
    console.log(`Payment failed for tran_id: ${tran_id}`);

    if (tran_id) {
      if (tran_id.startsWith("NEIGHBO_PLAN_")) {
        await prisma.adminRevenue.update({
          where: { tranId: tran_id },
          data: { status: "FAILED" },
        });
      } else if (tran_id.startsWith("NEIGHBO_UNLOCK_")) {
        await prisma.creatorEarning.update({
          where: { tranId: tran_id },
          data: { status: "FAILED" },
        });
      }
    }

    res.redirect(`${FRONTEND_URL}/payment/fail?tran_id=${tran_id || ""}`);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    SSLCommerz Cancel Callback
 */
export const paymentCancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { tran_id } = req.body;
    console.log(`Payment cancelled for tran_id: ${tran_id}`);

    if (tran_id) {
      if (tran_id.startsWith("NEIGHBO_PLAN_")) {
        await prisma.adminRevenue.update({
          where: { tranId: tran_id },
          data: { status: "FAILED" },
        });
      } else if (tran_id.startsWith("NEIGHBO_UNLOCK_")) {
        await prisma.creatorEarning.update({
          where: { tranId: tran_id },
          data: { status: "FAILED" },
        });
      }
    }

    res.redirect(`${FRONTEND_URL}/payment/cancel`);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Verify transaction status (client-side check)
 * @route   GET /api/payments/verify/:tranId
 */
export const verifyTransaction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { tranId } = req.params as { tranId: string };
    const userId = req.user.id;

    let transaction: any;

    if (tranId && tranId.startsWith("NEIGHBO_PLAN_")) {
      transaction = await prisma.adminRevenue.findUnique({
        where: { tranId: tranId as string },
        include: { user: { select: { displayName: true, email: true } } },
      });
    } else {
      transaction = await prisma.creatorEarning.findUnique({
        where: { tranId: tranId as string },
        include: {
          post: true, // Assuming relation name is post in schema
        },
      });
    }

    if (!transaction) {
      res.status(404).json({ message: "Transaction not found." });
      return;
    }

    res.json(transaction);
  } catch (error) {
    next(error);
  }
};
