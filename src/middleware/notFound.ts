import { type NextFunction, type Request, type Response } from 'express'; // TS Change: Imported Express types

// TS Change: Added types for req and res
function notFound(req: Request, res: Response): Response {
  return res.status(404).json({ error: "Not Found" });
}

export default notFound;