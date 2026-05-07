import { type Request, type Response, type NextFunction } from "express";
import prisma from "../../config/prisma.js";

/**
 * @desc    Get user notifications
 * @route   GET /api/notifications
 * @access  Private
 */
export const getNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user.id;
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20
    });
    res.json(notifications);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get unread notifications count
 * @route   GET /api/notifications/unread-count
 * @access  Private
 */
export const getUnreadCount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user.id;
    const count = await prisma.notification.count({
      where: { userId, isRead: false }
    });
    res.json({ count });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark notification as read
 * @route   PATCH /api/notifications/:id/read
 * @access  Private
 */
export const markAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userId = req.user.id;

    const existing = await prisma.notification.findUnique({ where: { id } });

    if (!existing || existing.userId !== userId) {
      // Explicitly return 403 Forbidden if the user doesn't own this notification
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    // FIX: STEP 2 - Perform the update using only the unique primary key 'id'
    const notification = await prisma.notification.update({
      where: { id },
      data: { isRead: true }
    });
    res.json(notification);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark all as read
 * @route   PATCH /api/notifications/read-all
 * @access  Private
 */
export const markAllAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user.id;
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true }
    });
    res.json({ message: "All marked as read" });
  } catch (error) {
    next(error);
  }
};
