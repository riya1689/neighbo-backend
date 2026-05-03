import type { Request, Response, NextFunction } from "express";
import prisma from "../../config/prisma.js";

/**
 * @desc    Get dashboard statistics
 * @route   GET /api/admin/stats
 * @access  Private/Admin
 */
export const getStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const [
      totalUsers,
      totalPremiumUsers,
      totalRevenue,
      totalPremiumPlanPurchases,
      totalCategories,
      totalNeighborhoods,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { subscriptions: { some: { isActive: true } } } }),
      prisma.payment.aggregate({ _sum: { amount: true }, where: { status: "COMPLETED" } }),
      prisma.subscription.count(),
      prisma.category.count(),
      prisma.neighborhood.count(),
    ]);

    res.json({
      totalUsers,
      totalPremiumUsers,
      totalRevenue: totalRevenue._sum.amount || 0,
      totalPremiumPlanPurchases,
      totalCategories,
      totalNeighborhoods,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all users with search
 * @route   GET /api/admin/users
 * @access  Private/Admin
 */
export const getUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { search } = req.query;
    const where = search
      ? {
          OR: [
            { name: { contains: String(search), mode: "insensitive" as const } },
            { email: { contains: String(search), mode: "insensitive" as const } },
          ],
        }
      : {};

    const users = await prisma.user.findMany({
      where,
      include: {
        subscriptions: {
          select: {
            isActive: true,
            createdAt: true,
            planType: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formattedUsers = users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      joined: user.createdAt,
      isPremium: user.subscriptions.some((s) => s.isActive),
      purchaseCount: user.subscriptions.length,
      lastPlanType: user.subscriptions[0]?.planType || null,
    }));

    res.json(formattedUsers);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update user status (Suspend/Activate)
 * @route   PATCH /api/admin/users/:id/status
 * @access  Private/Admin
 */
export const updateUserStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["ACTIVE", "SUSPENDED"].includes(status)) {
      res.status(400).json({ message: "Invalid status" });
      return;
    }

    const user = await prisma.user.update({
      where: { id },
      data: { status },
    });

    res.json({ message: `User status updated to ${status}`, user });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all categories
 * @route   GET /api/admin/categories
 * @access  Private/Admin
 */
export const getCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const categories = await prisma.category.findMany({
      include: { _count: { select: { posts: true } } },
      orderBy: { name: "asc" },
    });
    res.json(categories);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create category
 * @route   POST /api/admin/categories
 * @access  Private/Admin
 */
export const createCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name } = req.body;
    const category = await prisma.category.create({ data: { name } });
    res.status(201).json(category);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete category
 * @route   DELETE /api/admin/categories/:id
 * @access  Private/Admin
 */
export const deleteCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.category.delete({ where: { id } });
    res.json({ message: "Category deleted" });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all neighborhoods
 * @route   GET /api/admin/neighborhoods
 * @access  Private/Admin
 */
export const getNeighborhoods = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const neighborhoods = await prisma.neighborhood.findMany({
      include: { _count: { select: { users: true } } },
      orderBy: { name: "asc" },
    });
    res.json(neighborhoods);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create neighborhood
 * @route   POST /api/admin/neighborhoods
 * @access  Private/Admin
 */
export const createNeighborhood = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description } = req.body;
    const neighborhood = await prisma.neighborhood.create({ data: { name, description } });
    res.status(201).json(neighborhood);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete neighborhood
 * @route   DELETE /api/admin/neighborhoods/:id
 * @access  Private/Admin
 */
export const deleteNeighborhood = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.neighborhood.delete({ where: { id } });
    res.json({ message: "Neighborhood deleted" });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Manage Premium Plans
 */
export const getPlans = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const plans = await prisma.premiumPlan.findMany({ orderBy: { price: "asc" } });
    res.json(plans);
  } catch (error) {
    next(error);
  }
};

export const createPlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description, price, duration } = req.body;
    const plan = await prisma.premiumPlan.create({
      data: { name, description, price: Number(price), duration: Number(duration) }
    });
    res.status(201).json(plan);
  } catch (error) {
    next(error);
  }
};

export const deletePlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.premiumPlan.delete({ where: { id } });
    res.json({ message: "Plan deleted" });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all payments
 * @route   GET /api/admin/payments
 * @access  Private/Admin
 */
export const getPayments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payments = await prisma.payment.findMany({
      include: {
        user: { select: { name: true, email: true } },
        invoice: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(payments);
  } catch (error) {
    next(error);
  }
};
