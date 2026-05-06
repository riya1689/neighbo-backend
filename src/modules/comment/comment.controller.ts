import type { Request, Response, NextFunction } from "express";
import prisma from "../../config/prisma.js";

/**
 * @desc    Get comments for a post
 * @route   GET /api/posts/:postId/comments
 * @access  Public/Private
 */
export const getPostComments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { postId } = req.params;

    const comments = await prisma.comment.findMany({
      where: { postId, parentId: null }, // Fetch top-level comments
      include: {
        user: { select: { id: true, displayName: true } },
        replies: {
          include: {
            user: { select: { id: true, displayName: true } }
          },
          orderBy: { createdAt: "asc" }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    res.json(comments);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a comment or reply
 * @route   POST /api/posts/:postId/comments
 * @access  Private
 */
export const createComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { postId } = req.params;
    const { content, parentId } = req.body;
    const userId = req.user.id;

    if (!content) {
      res.status(400).json({ message: "Comment content is required" });
      return;
    }

    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true, title: true }
    });

    if (!post) {
      res.status(404).json({ message: "Post not found" });
      return;
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        userId,
        postId,
        parentId: parentId || null
      },
      include: {
        user: { select: { displayName: true } }
      }
    });

    // Notify post owner or parent comment owner
    let notifyUserId = post.userId;
    let notificationType: "COMMENT" | "REPLY" = "COMMENT";
    let message = `${req.user.displayName} commented on your post: "${post.title.substring(0, 20)}..."`;

    if (parentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: parentId },
        select: { userId: true }
      });
      if (parentComment) {
        notifyUserId = parentComment.userId;
        notificationType = "REPLY";
        message = `${req.user.displayName} replied to your comment.`;
      }
    }

    if (notifyUserId !== userId) {
      await prisma.notification.create({
        data: {
          userId: notifyUserId,
          type: notificationType,
          message,
          link: `/posts/${postId}`
        }
      });
    }

    res.status(201).json(comment);
  } catch (error) {
    next(error);
  }
};
