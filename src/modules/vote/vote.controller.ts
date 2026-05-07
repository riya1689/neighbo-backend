import type { Request, Response, NextFunction } from "express";
import prisma from "../../config/prisma.js";

/**
 * @desc    Handle upvote/downvote for a post
 * @route   POST /api/posts/:postId/vote
 * @access  Private
 */
export const handleVote = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const postId = req.params.postId as string;
    const { type } = req.body; // UPVOTE or DOWNVOTE
    const userId = req.user.id;

    if (!["UPVOTE", "DOWNVOTE"].includes(type)) {
      res.status(400).json({ message: "Invalid vote type" });
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

    // Find existing vote
    const existingVote = await prisma.vote.findUnique({
      where: {
        userId_postId: { userId, postId }
      }
    });

    if (existingVote) {
      if (existingVote.type === type) {
        // Toggle off: Delete vote
        await prisma.vote.delete({
          where: { userId_postId: { userId, postId } }
        });
      } else {
        // Toggle type: Update vote
        await prisma.vote.update({
          where: { userId_postId: { userId, postId } },
          data: { type }
        });
      }
    } else {
      // Create new vote
      await prisma.vote.create({
        data: { userId, postId, type }
      });

      // Notify post owner (if not the voter)
      if (post.userId !== userId) {
        await prisma.notification.create({
          data: {
            userId: post.userId,
            type: "VOTE",
            message: `${req.user.displayName} ${type.toLowerCase()}d your post: "${post.title.substring(0, 20)}..."`,
            link: `/posts/${postId}`
          }
        });
      }
    }

    // Calculate new tally
    const [upvotes, downvotes] = await Promise.all([
      prisma.vote.count({ where: { postId, type: "UPVOTE" } }),
      prisma.vote.count({ where: { postId, type: "DOWNVOTE" } })
    ]);

    res.json({
      netVotes: upvotes - downvotes,
      userVote: existingVote?.type === type ? null : type
    });

  } catch (error) {
    next(error);
  }
};
