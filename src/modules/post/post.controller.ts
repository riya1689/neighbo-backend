import type { Request, Response, NextFunction } from "express";
import prisma from "../../config/prisma.js";

/**
 * @desc    Create a new post
 * @route   POST /api/posts
 * @access  Private
 */
export const createPost = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { title, content, images, isPremium, price, neighborhoodId, categoryId } = req.body;
    const userId = req.user.id;

    // Basic validation
    if (!title || !content || !neighborhoodId || !categoryId) {
      res.status(400).json({ message: "Please provide title, content, neighborhood, and category." });
      return;
    }

    const post = await prisma.post.create({
      data: {
        title,
        content,
        images: Array.isArray(images) ? images : images ? [images] : [],
        isPremium: Boolean(isPremium),
        price: isPremium ? Number(price) : 0,
        userId,
        neighborhoodId,
        categoryId,
      },
      include: {
        user: { select: { name: true } },
        category: { select: { name: true } },
        neighborhood: { select: { name: true } },
      }
    });

    res.status(201).json(post);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all posts (optional but useful for testing)
 * @route   GET /api/posts
 * @access  Public
 */
export const getAllPosts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const posts = await prisma.post.findMany({
      include: {
        user: { select: { name: true } },
        category: { select: { name: true } },
        neighborhood: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(posts);
  } catch (error) {
    next(error);
  }
};
