import { Request, Response } from "express";

export const notFoundHandler = (_req: Request, res: Response) => {
  res.status(404).json({
    code: "NOT_FOUND",
    message: "Route not found",
  });
};