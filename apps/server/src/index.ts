import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import logger from "./lib/logger";
import errorHandler from "./modules/ai/errorHandler";
import { notFoundHandler } from "./modules/http/notFound";
import { z } from "zod";
import authRoutes from "./modules/auth/routes";
import userRoutes from "./modules/users/routes";
import deviceRoutes from "./modules/devices/routes";
import scheduleRoutes from "./modules/schedule/routes";
import todoRoutes from "./modules/todos/routes";
import reminderRoutes from "./modules/reminders/routes";
import examRoutes from "./modules/exams/routes";
import documentRoutes from "./modules/documents/routes";
import quizRoutes from "./modules/quizzes/routes";
import contactRoutes from "./modules/contacts/routes";
import analyticsRoutes from "./modules/analytics/routes";
import { PrismaClient } from "@prisma/client";

const app = express();
const prisma = new PrismaClient();

// Global middleware
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN }));
app.use(express.json({ limit: "10mb" }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Request ID middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  req.id = Math.random().toString(36).substring(2, 10);
  logger.info({ reqId: req.id, method: req.method, url: req.url }, "Request received");
  next();
});

// Zod validation error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof z.ZodError) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      message: "Invalid request data",
      details: err.errors.map((e: any) => ({ path: e.path.join("."), message: e.message })),
    });
  }
  next(err);
});

// Routes organized by module
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/devices", deviceRoutes);
app.use("/api/v1/schedule", scheduleRoutes);
app.use("/api/v1/todos", todoRoutes);
app.use("/api/v1/reminders", reminderRoutes);
app.use("/api/v1/exams", examRoutes);
app.use("/api/v1/documents", documentRoutes);
app.use("/api/v1/quizzes", quizRoutes);
app.use("/api/v1/contacts", contactRoutes);
app.use("/api/v1/analytics", analyticsRoutes);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info({ port: PORT }, `Server running on port ${PORT}`);
});

export { app, prisma };