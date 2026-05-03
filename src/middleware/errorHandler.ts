import { Request, Response, NextFunction } from "express"; // TS Change: Imported Express types

/**
 * Global error handler (Express 4-arg middleware). Place after all routes and notFound.
 */
// TS Change: Added types for err (any/Error), req, res, and next
function errorHandler(err: any, req: Request, res: Response, next: NextFunction): Response | void {
  if (res.headersSent) {
    return next(err);
  }

  // TS Change: Accessing status properties on 'err' typed as any
  const statusCode = err.statusCode || err.status || 500;
  const message =
    statusCode === 500 && process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message || "Internal server error";

  return res.status(statusCode).json({ message });
}

export default errorHandler;