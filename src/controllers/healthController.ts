import type { Request, Response } from "express"; // TS Change: Imported Express types

// TS Change: Added types for req (Request), res (Response) and the return type
function getHealth(req: Request, res: Response): Response {
  return res.status(200).json({
    status: "Neighbo backend running"
  });
}

export { getHealth };