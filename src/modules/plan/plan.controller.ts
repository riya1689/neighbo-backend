import { type Request, type Response, type NextFunction } from "express";
import prisma from "../../config/prisma.js";

/**
 * @desc    Get all active premium plans
 * @route   GET /api/plans
 * @access  Public
 */
export const getActivePlans = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const plans = await prisma.premiumPlan.findMany({
      orderBy: { price: "asc" }
    });
    res.json(plans);
  } catch (error) {
    next(error);
  }
};
