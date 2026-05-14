import { type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcryptjs";
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
        displayName: true,
        username: true,
        email: true,
        role: true,
        neighborhoodId: true,
        bio: true,
        profileImage: true,
        nameLastUpdatedAt: true,
        passwordLastUpdatedAt: true,
        neighborhood: {
          select: {
            name: true,
          },
        },
        createdAt: true,
        subscriptions: {
          where: { isActive: true },
          select: { planType: true }
        }
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
    const targetUser = await prisma.user.findUnique({ where: { id : followingId as string } });
    if (!targetUser) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: { followerId: followerId as string, 
        followingId: followingId as string 
       },
       
      },
    });

    if (existingFollow) {
      // Unfollow
      await prisma.follow.delete({
        where: { followerId_followingId: { followerId : followerId as string,
           followingId: followingId as string  }
           },
      });
      res.json({ message: "Unfollowed successfully", isFollowing: false });
    } else {
      // Follow
      await prisma.$transaction([
        prisma.follow.create({
          data: { 
            followerId: followerId as string, 
            followingId: followingId as string  },
        }),
        prisma.notification.create({
          data: {
            userId: followingId as string,
            type: "FOLLOW",
            message: `${req.user.displayName || "Someone"} started following you.`,
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
      select: { id: true, displayName: true, username: true, profileImage: true, neighborhood: { select: { name: true } } },
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
        select: { id: true, displayName: true, username: true, profileImage: true, neighborhood: { select: { name: true } } },
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
          select: { id: true, displayName: true, username: true, profileImage: true, neighborhood: { select: { name: true } } }
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
          select: { id: true, displayName: true, username: true, profileImage: true, neighborhood: { select: { name: true } } }
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
      where: { username: username as string },
      select: {
        id: true,
        displayName: true,
        username: true,
        bio: true,
        profileImage: true,
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
      where: { username: username as string },
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
        user: { select: { displayName: true, username: true } },
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
        user: { select: { displayName: true, username: true } },
        post: {
          include: {
            user: { select: { displayName: true, username: true } },
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
        sharedBy: share.user.displayName,
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

/**
 * @desc    Update user profile (bio/displayName)
 * @route   PATCH /api/users/profile
 * @access  Private
 */
export const updateProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user.id;
    const { bio, displayName, neighborhoodId, profileImage } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { nameLastUpdatedAt: true, displayName: true, neighborhoodId: true }
    });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const dataToUpdate: any = {};

    if (neighborhoodId && !user.neighborhoodId) {
      // Allow setting neighborhoodId if it hasn't been set yet
      dataToUpdate.neighborhoodId = neighborhoodId;
    }

    if (bio !== undefined) {
      dataToUpdate.bio = bio;
    }

    if (profileImage !== undefined) {
      dataToUpdate.profileImage = profileImage;
    }

    if (displayName && displayName !== user.displayName) {
      // Check cooldown
      if (user.nameLastUpdatedAt) {
        const now = new Date();
        const diff = now.getTime() - user.nameLastUpdatedAt.getTime();
        const daysDiff = diff / (1000 * 60 * 60 * 24);
        if (daysDiff < 28) {
          const remainingDays = Math.ceil(28 - daysDiff);
          res.status(400).json({ 
            message: `You can update your name in ${remainingDays} days.`,
            remainingDays 
          });
          return;
        }
      }
      dataToUpdate.displayName = displayName;
      dataToUpdate.nameLastUpdatedAt = new Date();
    }

    if (Object.keys(dataToUpdate).length === 0) {
      res.status(400).json({ message: "No changes provided" });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
      select: {
        id: true,
        displayName: true,
        username: true,
        bio: true,
        profileImage: true,
        nameLastUpdatedAt: true,
        passwordLastUpdatedAt: true
      }
    });

    res.json({ message: "Profile updated successfully", user: updatedUser });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update user password
 * @route   PATCH /api/users/password
 * @access  Private
 */
export const updatePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ message: "Please provide current and new password" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      res.status(401).json({ message: "Invalid current password" });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        passwordLastUpdatedAt: new Date()
      }
    });

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    next(error);
  }
};
