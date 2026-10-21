import { Request, Response } from "express";
import { sendError } from "../http/response";

export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, {
    status: 404,
    code: "NOT_FOUND",
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
}
