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

    // 2. Fetch candidates
    const candidates = await prisma.post.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true } },
        category: { select: { name: true } },
        neighborhood: { select: { name: true } },
        votes: { select: { type: true, userId: true } },
        comments: { select: { id: true, userId: true } },
      }
    });

    // 3. Fetch impressions for penalty
    const impressions = await prisma.postImpression.findMany({
      where: { userId },
      select: { postId: true }
    });
    const seenPostIds = new Set(impressions.map(i => i.postId));

    // Calculate score
    const scoredPosts = candidates.map(post => {
      let score = 0;
      const isNew = (new Date().getTime() - new Date(post.createdAt).getTime()) < 24 * 60 * 60 * 1000;

      // Tier 1: Locality + Freshness
      if (neighborhoodId && post.neighborhoodId === neighborhoodId) {
        score += isNew ? 50 : 25;
      }

      // Tier 2: Social Relevance
      if (followingIds.includes(post.userId)) {
        score += 40;
      }

      // Tier 3: Network Activity
      const hasFollowerInteraction = 
        post.votes.some(v => followingIds.includes(v.userId)) ||
        post.comments.some(c => followingIds.includes(c.userId));
      if (hasFollowerInteraction) {
        score += 30;
      }
      
      // Tier 5: High Engagement
      const engagement = post.votes.length + post.comments.length;
      score += Math.min(engagement * 2, 15);

      // Tier 6: Fallback (Recency)
      if (isNew) score += 10;

      // Apply "Seen" Penalty
      if (seenPostIds.has(post.id)) {
        score -= 45;
      }

      const { votes, comments, ...postData } = post;
      const upvotes = votes.filter(v => v.type === "UPVOTE").length;
      const downvotes = votes.filter(v => v.type === "DOWNVOTE").length;

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
          { user: { name: { contains: queryStr, mode: "insensitive" } } },
        ],
      },
      include: {
        user: { select: { name: true } },
        category: { select: { name: true } },
        neighborhood: { select: { name: true } },
        votes: true,
        comments: true,
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
        commentCount: post.comments.length
      };
    });

    res.json(mappedPosts);
  } catch (error) {
    next(error);
  }
};

