import type { Request, Response, NextFunction } from "express"; // TS Change: Imported Express types
import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js"; // TS Change: Removed .js extension
import { JWT_SECRET } from "../config/env.js"; // TS Change: Removed .js extension

// TS Change: Define the shape of your JWT payload
interface DecodedToken extends jwt.JwtPayload {
  userId: string;
}

// TS Change: Extend the Express Request interface to include the user object
// This allows req.user to be recognized by the compiler
declare global {
  namespace Express {
    interface Request {
      user?: any; 
    }
  }
}

// TS Change: Added types for req, res, and next
export const protect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader: string = req.headers.authorization || "";
    let token: string = "";

    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7).trim();
    } else {
      token = authHeader.trim();
    }

    if (!token) {
      const err: any = new Error("Unauthorized: token missing"); // TS Change: err typed as any for statusCode
      err.statusCode = 401;
      return next(err);
    }

    // TS Change: Cast the verification result to our interface
    const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        displayName: true,
        email: true,
        role: true,
        status: true,
        neighborhoodId: true,
        nameLastUpdatedAt: true,
        passwordLastUpdatedAt: true,
        createdAt: true
      }
    });

    if (!user) {
      const err: any = new Error("Unauthorized: user not found");
      err.statusCode = 401;
      return next(err);
    }

    if (user.status === "SUSPENDED") {
      const err: any = new Error("Your account has been suspended. Please contact support.");
      err.statusCode = 403;
      return next(err);
    }

    req.user = user;
    return next();
  } catch (_error) {
    const err: any = new Error("Unauthorized: invalid token");
    err.statusCode = 401;
    return next(err);
  }
}

// TS Change: roles is typed as a string array
export const restrictTo = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      const err: any = new Error("Forbidden: You do not have permission to perform this action");
      err.statusCode = 403;
      return next(err);
    }
    next();
  };
};

export default protect;