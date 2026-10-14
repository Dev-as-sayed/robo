import { Request, Response, NextFunction } from "express";

export default function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error("Unhandled error:", err);
  const status = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(status).json({
    code: err.code || "INTERNAL_ERROR",
    message,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
}

export { errorHandler };