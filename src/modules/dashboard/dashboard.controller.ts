import { type Request, type Response, type NextFunction } from "express";
import prisma from "../../config/prisma.js";

/**
 * @desc    Get user dashboard stats
 * @route   GET /api/dashboard/stats
 * @access  Private
 */
export const getStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user.id;

    const [totalRevenue, totalSales, totalPosts] = await Promise.all([
      prisma.creatorEarning.aggregate({
        _sum: { amount: true },
        where: { creatorId: userId, status: "COMPLETED" }
      }).catch(() => ({ _sum: { amount: 0 } })),
      prisma.creatorEarning.count({
        where: { creatorId: userId, status: "COMPLETED" }
      }).catch(() => 0),
      prisma.post.count({
        where: { userId }
      }).catch(() => 0),
    ]);

    res.json({
      totalRevenue: totalRevenue._sum?.amount || 0,
      totalSales: totalSales || 0,
      totalPosts: totalPosts || 0,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get user dashboard transactions
 * @route   GET /api/dashboard/transactions
 * @access  Private
 */
export const getTransactions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user.id;

    const transactions = await prisma.creatorEarning.findMany({
      where: { creatorId: userId },
      include: {
        payer: { select: { displayName: true, email: true } },
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
 * @desc    Get user's own posts
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
        neighborhood: { select: { name: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    res.json(posts);
  } catch (error) {
    next(error);
  }
};
