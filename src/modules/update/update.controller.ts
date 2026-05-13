import { type Request, type Response, type NextFunction } from "express";
import prisma from "../../config/prisma.js";

/**
 * @desc    Create a new official update (Admin only)
 * @route   POST /api/updates
 * @access  Admin
 */
export const createUpdate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { title, content, images, updateType, neighborhoodId, categoryId } = req.body;
    const userId = req.user.id;

    if (!title || !content || !updateType || !neighborhoodId || !categoryId) {
      res.status(400).json({ message: "Please provide title, content, update type, neighborhood, and category." });
      return;
    }

    const post = await prisma.post.create({
      data: {
        title,
        content,
        images: Array.isArray(images) ? images : images ? [images] : [],
        isUpdate: true,
        updateType,
        userId,
        neighborhoodId,
        categoryId,
      },
      include: {
        user: { select: { displayName: true } },
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
 * @desc    Get all official updates
 * @route   GET /api/updates
 * @access  Public
 */
export const getUpdates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { limit } = req.query;
    
    const updates = await prisma.post.findMany({
      where: { 
        isUpdate: true,
        isDeleted: false
      },
      take: limit ? Number(limit) : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { displayName: true, username: true } },
        category: { select: { name: true } },
        neighborhood: { select: { name: true } },
      }
    });

    res.json(updates);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update official update title (Admin only)
 * @route   PATCH /api/updates/:id
 * @access  Admin
 */
export const updateUpdate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { title } = req.body;

    const post = await prisma.post.findUnique({ where: { id } });

    if (!post || !post.isUpdate) {
      res.status(404).json({ message: "Update not found" });
      return;
    }

    const updatedPost = await prisma.post.update({
      where: { id },
      data: {
        title: title || post.title,
      },
    });

    res.json(updatedPost);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete official update (Admin only)
 * @route   DELETE /api/updates/:id
 * @access  Admin
 */
export const deleteUpdate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const post = await prisma.post.findUnique({ where: { id } });

    if (!post || !post.isUpdate) {
      res.status(404).json({ message: "Update not found" });
      return;
    }

    await prisma.post.update({
      where: { id },
      data: { isDeleted: true }
    });

    res.json({ message: "Update deleted successfully" });
  } catch (error) {
    next(error);
  }
};
