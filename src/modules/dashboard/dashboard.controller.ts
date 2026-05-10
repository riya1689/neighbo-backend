import { type Request, type Response, type NextFunction } from "express";
import prisma from "../../config/prisma.js";

/**
 * @desc    Get user dashboard stats (Expanded to 7 metrics)
 * @route   GET /api/dashboard/stats
 * @access  Private
 */
export const getStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user.id;

    const [
      totalRevenue, 
      totalPremiumPlanPurchases, 
      totalPosts, 
      totalFollowers, 
      totalFollowing, 
      totalPremiumContentPurchases
    ] = await Promise.all([
      // 1. Total Revenue (Earnings from others unlocking my content)
      prisma.creatorEarning.aggregate({
        _sum: { amount: true },
        where: { creatorId: userId, status: "COMPLETED" }
      }).then(res => res._sum?.amount || 0),

      // 2. Total Premium Plan Purchases (Plans I bought)
      prisma.adminRevenue.count({
        where: { userId, status: "COMPLETED" }
      }),

      // 3. Total Posts Created
      prisma.post.count({
        where: { userId, isDeleted: false }
      }),

      // 4. Total Followers
      prisma.follow.count({
        where: { followingId: userId }
      }),

      // 5. Total Following
      prisma.follow.count({
        where: { followerId: userId }
      }),

      // 7. Total Premium Content Purchases (Content I unlocked)
      prisma.creatorEarning.count({
        where: { payerId: userId, status: "COMPLETED" }
      })
    ]);

    res.json({
      totalRevenue,
      totalPremiumPlanPurchases,
      totalPosts,
      totalFollowers,
      totalFollowing,
      totalNeighbos: totalFollowers + totalFollowing, // Consistent with /api/users/stats
      totalPremiumContentPurchases
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get user dashboard transactions (Sales history)
 * @route   GET /api/dashboard/transactions
 * @access  Private
 */
export const getTransactions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user.id;

    const transactions = await prisma.creatorEarning.findMany({
      where: { creatorId: userId },
      include: {
        payer: { select: { displayName: true, email: true, username: true } },
        post: { select: { title: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    res.json(transactions);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get user's own posts with metrics
 * @route   GET /api/dashboard/posts
 * @access  Private
 */
export const getPosts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user.id;

    const posts = await prisma.post.findMany({
      where: { userId },
      include: {
        category: { select: { name: true } },
        neighborhood: { select: { name: true } },
        _count: {
          select: {
            comments: true,
            votes: true,
            shares: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    res.json(posts);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get premium content purchases (Content I unlocked)
 * @route   GET /api/dashboard/purchases
 * @access  Private
 */
export const getPurchases = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user.id;

    const purchases = await prisma.creatorEarning.findMany({
      where: { payerId: userId },
      include: {
        creator: { select: { displayName: true, username: true } },
        payer: { select: { username: true } },
        post: { select: { title: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    res.json(purchases);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get my premium plans
 * @route   GET /api/dashboard/plans
 * @access  Private
 */
export const getPremiumPlans = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user.id;

    const plans = await prisma.adminRevenue.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });

    res.json(plans);
  } catch (error) {
    next(error);
  }
};
