import { NextFunction, Request, Response } from "express";
import logger from "../lib/logger";

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const payload = {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
    };

    if (res.statusCode >= 500) {
      logger.error(payload, "request completed");
    } else if (res.statusCode >= 400) {
      logger.warn(payload, "request completed");
    } else {
      logger.info(payload, "request completed");
    }
  });

  next();
}
