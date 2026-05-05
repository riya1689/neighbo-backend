import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import prisma from "../../config/prisma.js";
import generateToken from "../../utils/generateToken.js";

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, email, password, neighborhoodId } = req.body;

    if (!name || !email || !password || !neighborhoodId) {
      res.status(400).json({ message: "Please provide all required fields" });
      return;
    }

    // Check if user already exists
    const userExists = await prisma.user.findUnique({
      where: { email },
    });

    if (userExists) {
      res.status(400).json({ message: "User already exists" });
      return;
    }

    // Check if neighborhood exists
    const neighborhood = await prisma.neighborhood.findUnique({
      where: { id: neighborhoodId },
    });

    if (!neighborhood) {
      res.status(400).json({ message: "Invalid neighborhood selected" });
      return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate unique username
    let baseUsername = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (!baseUsername) baseUsername = 'user';
    
    let username = baseUsername;
    let counter = 1;
    let usernameExists = true;

    while (usernameExists) {
      const existing = await prisma.user.findUnique({ where: { username } });
      if (!existing) {
        usernameExists = false;
      } else {
        username = `${baseUsername}_${counter}`;
        counter++;
      }
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        username,
        password: hashedPassword,
        neighborhoodId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        role: true,
        neighborhoodId: true,
        createdAt: true,
      },
    });

    if (user) {
      res.status(201).json({
        ...user,
        token: generateToken(user.id),
      });
    } else {
      res.status(400).json({ message: "Invalid user data" });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Authenticate a user & get token
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: "Please provide email and password" });
      return;
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        neighborhood: {
          select: {
            name: true,
          }
        }
      }
    });

    if (user && (await bcrypt.compare(password, user.password))) {
      const { password: _, ...userWithoutPassword } = user;
      res.json({
        ...userWithoutPassword,
        token: generateToken(user.id),
      });
    } else {
      res.status(401).json({ message: "Invalid email or password" });
    }
  } catch (error) {
    next(error);
  }
};
