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
        username: true,
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
      select: { id: true, name: true, username: true, neighborhood: { select: { name: true } } },
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
        select: { id: true, name: true, username: true, neighborhood: { select: { name: true } } },
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
          select: { id: true, name: true, username: true, neighborhood: { select: { name: true } } }
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
          select: { id: true, name: true, username: true, neighborhood: { select: { name: true } } }
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

/**
 * @desc    Get public profile
 * @route   GET /api/users/profile/public/:username
 * @access  Public
 */
export const getPublicProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { username } = req.params;

    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        name: true,
        username: true,
        bio: true,
        role: true,
        neighborhood: { select: { name: true } },
        createdAt: true,
        subscriptions: {
          where: { isActive: true },
          select: { planType: true }
        },
        _count: {
          select: {
            posts: true,
            followers: true,
            following: true,
            shares: true
          }
        }
      }
    });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const { _count, ...userData } = user;
    const totalPosts = _count.posts + _count.shares;
    const totalNeighbos = _count.followers + _count.following;

    res.json({
      ...userData,
      totalPosts,
      totalNeighbos,
      isPremium: userData.subscriptions.length > 0
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get public profile posts
 * @route   GET /api/users/profile/public/:username/posts
 * @access  Public
 */
export const getPublicProfilePosts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { username } = req.params;

    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true }
    });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const userId = user.id;

    // Fetch original posts
    const posts = await prisma.post.findMany({
      where: { userId },
      include: {
        user: { select: { name: true, username: true } },
        category: { select: { name: true } },
        neighborhood: { select: { name: true } },
        votes: { select: { type: true, userId: true } },
        comments: { select: { id: true, userId: true } },
        shares: { select: { id: true, userId: true } },
      }
    });

    // Fetch shares
    const shares = await prisma.share.findMany({
      where: { userId },
      include: {
        user: { select: { name: true, username: true } },
        post: {
          include: {
            user: { select: { name: true, username: true } },
            category: { select: { name: true } },
            neighborhood: { select: { name: true } },
            votes: { select: { type: true, userId: true } },
            comments: { select: { id: true, userId: true } },
            shares: { select: { id: true, userId: true } },
          }
        }
      }
    });

    const timeline: any[] = [];

    posts.forEach(post => {
      timeline.push({
        ...post,
        feedId: post.id,
        sharedBy: null,
        shareCount: post.shares.length,
        activityDate: post.createdAt,
        _isShare: false
      });
    });

    shares.forEach(share => {
      timeline.push({
        ...share.post,
        feedId: `share-${share.id}`,
        sharedBy: share.user.name,
        shareCount: share.post.shares.length,
        activityDate: share.createdAt,
        _isShare: true,
        _shareUserId: share.userId
      });
    });

    // Sort chronologically
    timeline.sort((a, b) => new Date(b.activityDate).getTime() - new Date(a.activityDate).getTime());

    // Map to include counts (similar to algorithmic feed)
    const result = timeline.map(post => {
      const { votes, comments, shares: _, activityDate: __, _isShare, _shareUserId, ...postData } = post;
      const upvotes = votes.filter((v: any) => v.type === "UPVOTE").length;
      const downvotes = votes.filter((v: any) => v.type === "DOWNVOTE").length;

      return {
        ...postData,
        netVotes: upvotes - downvotes,
        commentCount: comments.length
      };
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
};
