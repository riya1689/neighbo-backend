import type { Request, Response, NextFunction } from "express";
import prisma from "../../config/prisma.js";

/**
 * @desc    Get user profile
 * @route   GET /api/users/profile
 * @access  Private
 */
export const getUserProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        neighborhoodId: true,
        neighborhood: {
          select: {
            name: true,
          },
        },
        createdAt: true,
      },
    });

    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Toggle follow/unfollow a user
 * @route   POST /api/users/:id/follow
 * @access  Private
 */
export const toggleFollow = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const followerId = req.user.id;
    const followingId = req.params.id;

    if (followerId === followingId) {
      res.status(400).json({ message: "You cannot follow yourself" });
      return;
    }

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({ where: { id: followingId } });
    if (!targetUser) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: { followerId, followingId },
      },
    });

    if (existingFollow) {
      // Unfollow
      await prisma.follow.delete({
        where: { followerId_followingId: { followerId, followingId } },
      });
      res.json({ message: "Unfollowed successfully", isFollowing: false });
    } else {
      // Follow
      await prisma.$transaction([
        prisma.follow.create({
          data: { followerId, followingId },
        }),
        prisma.notification.create({
          data: {
            userId: followingId,
            type: "FOLLOW",
            message: `${req.user.name || "Someone"} started following you.`,
          },
        }),
      ]);
      res.status(201).json({ message: "Followed successfully", isFollowing: true });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get suggested users to follow
 * @route   GET /api/users/suggested
 * @access  Private
 */
export const getSuggestedUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUserId = req.user.id;

    // Get current user's following list and neighborhood
    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { neighborhoodId: true, following: { select: { followingId: true } } },
    });

    const followingIds = currentUser?.following.map((f) => f.followingId) || [];
    const excludedIds = [currentUserId, ...followingIds];

    // Priority 1: Users in the same neighborhood
    const neighborhoodSuggestions = await prisma.user.findMany({
      where: {
        id: { notIn: excludedIds },
        neighborhoodId: currentUser?.neighborhoodId,
      },
      take: 5,
      select: { id: true, name: true, neighborhood: { select: { name: true } } },
    });

    // Priority 2: Fill remaining slots with recent active users
    let suggestions = [...neighborhoodSuggestions];
    if (suggestions.length < 5) {
      const remainingSlots = 5 - suggestions.length;
      const otherSuggestions = await prisma.user.findMany({
        where: {
          id: { notIn: [...excludedIds, ...suggestions.map(s => s.id)] },
        },
        orderBy: { createdAt: 'desc' },
        take: remainingSlots,
        select: { id: true, name: true, neighborhood: { select: { name: true } } },
      });
      suggestions = [...suggestions, ...otherSuggestions];
    }

    res.json(suggestions);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get followers
 * @route   GET /api/users/followers
 * @access  Private
 */
export const getFollowers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const followers = await prisma.follow.findMany({
      where: { followingId: req.user.id },
      include: {
        follower: {
          select: { id: true, name: true, neighborhood: { select: { name: true } } }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(followers.map(f => f.follower));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get following
 * @route   GET /api/users/following
 * @access  Private
 */
export const getFollowing = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const following = await prisma.follow.findMany({
      where: { followerId: req.user.id },
      include: {
        following: {
          select: { id: true, name: true, neighborhood: { select: { name: true } } }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(following.map(f => f.following));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get connection stats
 * @route   GET /api/users/stats
 * @access  Private
 */
export const getConnectionStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const [followersCount, followingCount] = await Promise.all([
      prisma.follow.count({ where: { followingId: req.user.id } }),
      prisma.follow.count({ where: { followerId: req.user.id } })
    ]);

    res.json({
      followers: followersCount,
      following: followingCount,
      totalNeighbos: followersCount + followingCount
    });
  } catch (error) {
    next(error);
  }
};
