import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import { TooManyRequestsError } from "./errors/app-error";
import { sendSuccess } from "./http/response";
import { errorHandler } from "./middleware/error-handler";
import { notFoundHandler } from "./middleware/not-found";
import { requestId } from "./middleware/request-id";
import { requestLogger } from "./middleware/request-logger";
import authRoutes from "./modules/auth/routes";
import userRoutes from "./modules/users/routes";
import adminRoutes from "./modules/admin/routes";
import deviceRoutes from "./modules/devices/routes";
import chatRoutes from "./modules/chat/routes";
import actionRoutes from "./modules/actions/routes";
import scheduleRoutes from "./modules/schedule/routes";
import todoRoutes from "./modules/todos/routes";
import reminderRoutes from "./modules/reminders/routes";
import examRoutes from "./modules/exams/routes";
import documentRoutes from "./modules/documents/routes";
import quizRoutes from "./modules/quizzes/routes";
import contactRoutes from "./modules/contacts/routes";
import analyticsRoutes from "./modules/analytics/routes";

function parseCorsOrigin(origin: string): true | string[] {
  if (origin.trim() === "*") {
    return true;
  }

  return origin
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function createApp(): express.Express {
  const app = express();

  app.disable("x-powered-by");

  if (env.TRUST_PROXY > 0) {
    app.set("trust proxy", env.TRUST_PROXY);
  }

  app.use(requestId);
  app.use(requestLogger);

  app.use(helmet());
  app.use(
    cors({
      origin: parseCorsOrigin(env.CORS_ORIGIN),
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
      exposedHeaders: ["X-Request-ID"],
      credentials: false,
    })
  );

  app.use(express.json({ limit: env.BODY_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: env.BODY_LIMIT }));

  app.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      limit: env.RATE_LIMIT_MAX,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      handler: (_req, _res, next) => next(new TooManyRequestsError()),
    })
  );

  const authLimiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.AUTH_RATE_LIMIT_MAX,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new TooManyRequestsError()),
  });

  app.use("/api/v1/auth/login", authLimiter);
  app.use("/api/v1/auth/register", authLimiter);
  app.use("/api/v1/auth/google", authLimiter);
  app.use("/api/v1/auth/refresh", authLimiter);

  const pairingLimiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.PAIRING_RATE_LIMIT_MAX,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new TooManyRequestsError()),
  });

  app.use("/api/v1/devices/pair", pairingLimiter);

  app.get("/health", (_req, res) => {
    sendSuccess(res, {
      code: "HEALTH_OK",
      message: "Service is healthy",
      data: {
        status: "ok",
        uptime: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
        environment: env.NODE_ENV,
      },
    });
  });

  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/users", userRoutes);
  app.use("/api/v1/admin", adminRoutes);
  app.use("/api/v1/devices", deviceRoutes);
  app.use("/api/v1/chat", chatRoutes);
  app.use("/api/v1/actions", actionRoutes);
  app.use("/api/v1/schedule", scheduleRoutes);
  app.use("/api/v1/todos", todoRoutes);
  app.use("/api/v1/reminders", reminderRoutes);
  app.use("/api/v1/exams", examRoutes);
  app.use("/api/v1/documents", documentRoutes);
  app.use("/api/v1/quizzes", quizRoutes);
  app.use("/api/v1/contacts", contactRoutes);
  app.use("/api/v1/analytics", analyticsRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
