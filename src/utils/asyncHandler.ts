import { Request, Response, NextFunction, RequestHandler } from "express"; // TS Change: Imported Express types

/**
 * Wrap an async route handler so Express forwards errors to error middleware.
 */
// TS Change: Defined 'fn' as a function that returns a Promise or any, and typed the wrapper parameters
function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any> | any): RequestHandler {
  return function wrapped(req: Request, res: Response, next: NextFunction): void {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export default asyncHandler;