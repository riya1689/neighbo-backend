import { type Request, type Response, type NextFunction } from "express";
import prisma from "../../config/prisma.js";

/**
 * @desc    Create a new event
 * @route   POST /api/events
 * @access  Private
 */
export const createEvent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { title, description, date, imageUrl, neighborhoodId, categoryId } = req.body;
    const userId = req.user.id;

    if (!title || !description || !date || !neighborhoodId || !categoryId) {
      res.status(400).json({ message: "Please provide title, description, date, neighborhood, and category." });
      return;
    }

    const event = await prisma.event.create({
      data: {
        title,
        description,
        date: new Date(date),
        imageUrl,
        userId,
        neighborhoodId,
        categoryId,
      },
      include: {
        user: { select: { displayName: true, username: true } },
        category: { select: { name: true } },
        neighborhood: { select: { name: true } },
      }
    });

    res.status(201).json(event);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get user's own events
 * @route   GET /api/events/my-events
 * @access  Private
 */
export const getUserEvents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user.id;
    const events = await prisma.event.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        category: { select: { name: true } },
        neighborhood: { select: { name: true } },
      }
    });
    res.json(events);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all events (Admin only)
 * @route   GET /api/events/admin/all
 * @access  Admin
 */
export const getAdminEvents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const events = await prisma.event.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { displayName: true, username: true } },
        category: { select: { name: true } },
        neighborhood: { select: { name: true } },
      }
    });
    res.json(events);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update event status (Admin only)
 * @route   PATCH /api/events/admin/:id/status
 * @access  Admin
 */
export const updateEventStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body; // APPROVED, REJECTED

    if (!["APPROVED", "REJECTED"].includes(status)) {
      res.status(400).json({ message: "Invalid status. Use APPROVED or REJECTED." });
      return;
    }

    const event = await prisma.event.update({
      where: { id },
      data: { status }
    });

    res.json(event);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update event title
 * @route   PATCH /api/events/:id/title
 * @access  Private
 */
export const updateEventTitle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { title } = req.body;
    const userId = req.user.id;

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      res.status(404).json({ message: "Event not found" });
      return;
    }

    if (event.userId !== userId) {
      res.status(403).json({ message: "Unauthorized to edit this event" });
      return;
    }

    const updated = await prisma.event.update({
      where: { id },
      data: { title }
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete event
 * @route   DELETE /api/events/:id
 * @access  Private
 */
export const deleteEvent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      res.status(404).json({ message: "Event not found" });
      return;
    }

    if (event.userId !== userId && req.user.role !== "ADMIN") {
      res.status(403).json({ message: "Unauthorized to delete this event" });
      return;
    }

    await prisma.event.delete({ where: { id } });
    res.json({ message: "Event deleted successfully" });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get approved upcoming events
 * @route   GET /api/events/approved
 * @access  Public
 */
export const getApprovedEvents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { limit } = req.query;
    const events = await prisma.event.findMany({
      where: { status: "APPROVED" },
      take: limit ? Number(limit) : undefined,
      orderBy: { date: "asc" }, // Show nearest events first
      include: {
        user: { select: { displayName: true, username: true } },
        category: { select: { name: true } },
        neighborhood: { select: { name: true } },
      }
    });
    res.json(events);
  } catch (error) {
    next(error);
  }
};
