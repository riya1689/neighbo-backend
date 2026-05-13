import { type Request, type Response, type NextFunction } from "express";
import prisma from "../../config/prisma.js";

/**
 * @desc    Create a new post
 * @route   POST /api/posts
 * @access  Private
 */
export const createPost = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { title, content, images, isPremium, price, unlockPrice, neighborhoodId, categoryId } = req.body;
    const userId = req.user.id;

    // Basic validation
    if (!title || !content || !neighborhoodId || !categoryId) {
      res.status(400).json({ message: "Please provide title, content, neighborhood, and category." });
      return;
    }

    // Validate unlockPrice when premium
    if (isPremium && (!unlockPrice || Number(unlockPrice) <= 0)) {
      res.status(400).json({ message: "Please set a valid unlock price (BDT) for premium content." });
      return;
    }

    const post = await prisma.post.create({
      data: {
        title,
        content,
        images: Array.isArray(images) ? images : images ? [images] : [],
        isPremium: Boolean(isPremium),
        price: isPremium ? Number(price || unlockPrice) : 0,
        unlockPrice: isPremium ? Number(unlockPrice) : null,
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
 * @desc    Get all posts (optional but useful for testing)
 * @route   GET /api/posts
 * @access  Public
 */
export const getAllPosts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { categoryId } = req.query;
    
    const posts = await prisma.post.findMany({
      where: {
        isUpdate: false,
        ...(categoryId ? { categoryId: String(categoryId) } : {})
      },
      include: {
        user: { select: { displayName: true, username: true } },
        category: { select: { name: true } },
        neighborhood: { select: { name: true } },
        votes: true,
        comments: true,
        shares: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const mappedPosts = posts.map(post => {
      const upvotes = post.votes.filter(v => v.type === "UPVOTE").length;
      const downvotes = post.votes.filter(v => v.type === "DOWNVOTE").length;
      return {
        ...post,
        netVotes: upvotes - downvotes,
        commentCount: post.comments.length,
        shareCount: post.shares.length
      };
    });

    res.json(mappedPosts);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Log post impressions
 * @route   POST /api/posts/impressions
 * @access  Private
 */
export const logImpressions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { postIds } = req.body;
    if (!Array.isArray(postIds) || postIds.length === 0) {
      res.status(400).json({ message: "postIds array is required" });
      return;
    }

    const userId = req.user.id;
    
    await prisma.postImpression.createMany({
      data: postIds.map(postId => ({
        userId,
        postId
      }))
    });

    res.status(201).json({ message: "Impressions logged" });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get algorithmic feed
 * @route   GET /api/posts/feed
 * @access  Private
 */
export const getAlgorithmicFeed = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user.id;

    // 1. Fetch user context
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { neighborhoodId: true, following: { select: { followingId: true } } }
    });
    
    const followingIds = user?.following.map(f => f.followingId) || [];
    const neighborhoodId = user?.neighborhoodId;

    // 2. Fetch candidates (exclude official updates from main feed)
    const recentPosts = await prisma.post.findMany({
      where: { isUpdate: false, isDeleted: false },
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { displayName: true } },
        category: { select: { name: true } },
        neighborhood: { select: { name: true } },
        votes: { select: { type: true, userId: true } },
        comments: { select: { id: true, userId: true } },
        shares: { select: { id: true, userId: true } },
      }
    });

    const recentShares = await prisma.share.findMany({
      where: {
        userId: { in: [userId, ...followingIds] }
      },
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { displayName: true } },
        post: {
          include: {
            user: { select: { displayName: true } },
            category: { select: { name: true } },
            neighborhood: { select: { name: true } },
            votes: { select: { type: true, userId: true } },
            comments: { select: { id: true, userId: true } },
            shares: { select: { id: true, userId: true } },
          }
        }
      }
    });

    const candidateList: any[] = [];
    
    recentPosts.forEach(post => {
      candidateList.push({
         ...post,
         feedId: post.id,
         sharedBy: null,
         shareCount: post.shares.length,
         activityDate: post.createdAt,
         _isShare: false
      });
    });

    recentShares.forEach(share => {
      candidateList.push({
         ...share.post,
         feedId: `share-${share.id}`,
         sharedBy: share.user.displayName,
         shareCount: share.post.shares.length,
         activityDate: share.createdAt,
         _isShare: true,
         _shareUserId: share.userId
      });
    });

    // 3. Fetch impressions for penalty
    const impressions = await prisma.postImpression.findMany({
      where: { userId },
      select: { postId: true }
    });
    const seenPostIds = new Set(impressions.map(i => i.postId));

    // Calculate score
    const scoredPosts = candidateList.map(post => {
      let score = 0;
      const isNew = (new Date().getTime() - new Date(post.activityDate).getTime()) < 24 * 60 * 60 * 1000;

      // Tier 1: Locality + Freshness
      if (neighborhoodId && post.neighborhoodId === neighborhoodId) {
        score += isNew ? 50 : 25;
      }

      // Tier 2: Social Relevance
      if (followingIds.includes(post.userId)) {
        score += 40;
      }
      if (post._isShare && followingIds.includes(post._shareUserId)) {
        score += 45; // Boost shared posts by followed users
      }
      if (post._isShare && post._shareUserId === userId) {
        score += 50; // Boost own shares
      }

      // Tier 3: Network Activity
      const hasFollowerInteraction = 
        post.votes.some((v: any) => followingIds.includes(v.userId)) ||
        post.comments.some((c: any) => followingIds.includes(c.userId));
      if (hasFollowerInteraction) {
        score += 30;
      }
      
      // Tier 5: High Engagement
      const engagement = post.votes.length + post.comments.length + post.shareCount;
      score += Math.min(engagement * 2, 15);

      // Tier 6: Fallback (Recency)
      if (isNew) score += 10;

      // Apply "Seen" Penalty (only if it's the original post, or penalize both?)
      if (seenPostIds.has(post.id) && !post._isShare) {
        score -= 45;
      }

      const { votes, comments, shares, activityDate, _isShare, _shareUserId, ...postData } = post;
      const upvotes = votes.filter((v: any) => v.type === "UPVOTE").length;
      const downvotes = votes.filter((v: any) => v.type === "DOWNVOTE").length;

      return {
        ...postData,
        _score: score,
        netVotes: upvotes - downvotes,
        commentCount: comments.length
      };
    });

    // 4. Sort by score
    scoredPosts.sort((a, b) => b._score - a._score);

    res.json(scoredPosts);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Search posts by query (category, neighborhood, username)
 * @route   GET /api/posts/search
 * @access  Public
 */
export const searchPosts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { q } = req.query;
    const queryStr = q ? String(q).trim() : "";

    const posts = await prisma.post.findMany({
      where: {
        OR: [
          { title: { contains: queryStr, mode: "insensitive" } },
          { content: { contains: queryStr, mode: "insensitive" } },
          { category: { name: { contains: queryStr, mode: "insensitive" } } },
          { neighborhood: { name: { contains: queryStr, mode: "insensitive" } } },
          { user: { displayName: { contains: queryStr, mode: "insensitive" } } },
        ],
        isUpdate: false,
      },
      include: {
        user: { select: { displayName: true } },
        category: { select: { name: true } },
        neighborhood: { select: { name: true } },
        votes: true,
        comments: true,
        shares: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Map to include counts
    const mappedPosts = posts.map(post => {
      const upvotes = post.votes.filter(v => v.type === "UPVOTE").length;
      const downvotes = post.votes.filter(v => v.type === "DOWNVOTE").length;
      return {
        ...post,
        netVotes: upvotes - downvotes,
        commentCount: post.comments.length,
        shareCount: post.shares.length
      };
    });

    res.json(mappedPosts);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get trending posts
 * @route   GET /api/posts/trending
 * @access  Public
 */
export const getTrendingPosts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const posts = await prisma.post.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo },
        isUpdate: false,
      },
      include: {
        user: { select: { displayName: true, username: true } },
        category: { select: { name: true } },
        neighborhood: { select: { name: true } },
        votes: true,
        comments: true,
        shares: { select: { id: true } },
      },
      take: 20
    });

    const scoredPosts = posts.map(post => {
      const upvotes = post.votes.filter(v => v.type === "UPVOTE").length;
      const downvotes = post.votes.filter(v => v.type === "DOWNVOTE").length;
      const netVotes = upvotes - downvotes;
      const commentCount = post.comments.length;
      const shareCount = post.shares.length;
      
      // Scored by activity
      const score = (upvotes * 2) + commentCount + (shareCount * 1.5);

      return {
        ...post,
        netVotes,
        commentCount,
        shareCount,
        _score: score
      };
    });

    scoredPosts.sort((a, b) => b._score - a._score);

    res.json(scoredPosts);
  } catch (error) {
    next(error);
  }
};


/**
 * @desc    Share a post
 * @route   POST /api/posts/:postId/share
 * @access  Private
 */
export const sharePost = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const postId = req.params.postId as string;
    const userId = req.user.id;

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      res.status(404).json({ message: "Post not found" });
      return;
    }

    const share = await prisma.share.create({
      data: {
        userId,
        postId
      }
    });

    if (post.userId !== userId) {
      await prisma.notification.create({
        data: {
          userId: post.userId,
          message: `${req.user.displayName} shared your post`,
          type: "SHARE",
          link: `/posts/${postId}`
        }
      });
    }

    const shareCount = await prisma.share.count({ where: { postId } });
    res.status(201).json({ message: "Post shared successfully", shareCount });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update post
 * @route   PATCH /api/posts/:id
 * @access  Private
 */
export const updatePost = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;
    const userId = req.user.id;

    const post = await prisma.post.findUnique({ where: { id } });

    if (!post) {
      res.status(404).json({ message: "Post not found" });
      return;
    }

    if (post.userId !== userId) {
      res.status(403).json({ message: "Unauthorized to edit this post" });
      return;
    }

    const updatedPost = await prisma.post.update({
      where: { id },
      data: {
        title: title || post.title,
        content: content || post.content,
      },
      include: {
        user: { select: { displayName: true } },
        category: { select: { name: true } },
        neighborhood: { select: { name: true } },
      }
    });

    res.json(updatedPost);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete post (Soft Delete)
 * @route   DELETE /api/posts/:id
 * @access  Private
 */
export const deletePost = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const post = await prisma.post.findUnique({ where: { id } });

    if (!post) {
      res.status(404).json({ message: "Post not found" });
      return;
    }

    if (post.userId !== userId && req.user.role !== "ADMIN") {
      res.status(403).json({ message: "Unauthorized to delete this post" });
      return;
    }

    // Soft delete: update isDeleted field
    await prisma.post.update({
      where: { id },
      data: { isDeleted: true }
    });

    res.json({ message: "Post deleted successfully" });
  } catch (error) {
    next(error);
  }
};
