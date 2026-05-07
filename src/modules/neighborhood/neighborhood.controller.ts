import { type Request, type Response, type NextFunction } from "express";
import prisma from "../../config/prisma.js";

/**
 * @desc    Get all neighborhoods
 * @route   GET /api/neighborhoods
 * @access  Public
 */
export const getAllNeighborhoods = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const neighborhoods = await prisma.neighborhood.findMany({
      orderBy: { name: "asc" },
    });
    res.json(neighborhoods);
  } catch (error) {
    next(error);
  }
};
