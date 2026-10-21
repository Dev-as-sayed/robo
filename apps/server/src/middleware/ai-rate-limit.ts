import rateLimit from "express-rate-limit";
import { env } from "../config/env";
import { TooManyRequestsError } from "../errors/app-error";

export const aiMessageLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.AI_RATE_LIMIT_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? req.ip ?? "unknown",
  handler: (_req, _res, next) => next(new TooManyRequestsError()),
});
