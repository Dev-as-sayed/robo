import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { isAppError } from "../errors/app-error";
import { sendError } from "../http/response";
import logger from "../lib/logger";

interface NormalizedError {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

const DOMAIN_ERRORS: Record<string, { statusCode: number; message: string }> = {
  EMAIL_ALREADY_EXISTS: {
    statusCode: 409,
    message: "An account with this email already exists",
  },
  INVALID_CREDENTIALS: { statusCode: 401, message: "Invalid email or password" },
  INVALID_TOKEN: { statusCode: 401, message: "Invalid or expired token" },
  INVALID_REFRESH_TOKEN: { statusCode: 401, message: "Invalid refresh token" },
  REFRESH_TOKEN_REUSED: {
    statusCode: 401,
    message: "Refresh token has already been used; all sessions were revoked",
  },
  TOKEN_EXPIRED: { statusCode: 401, message: "Token has expired" },
  INVALID_GOOGLE_TOKEN: { statusCode: 401, message: "Invalid Google ID token" },
  GOOGLE_EMAIL_NOT_VERIFIED: { statusCode: 403, message: "Google email is not verified" },
  GOOGLE_AUTH_NOT_CONFIGURED: {
    statusCode: 503,
    message: "Google sign-in is not configured",
  },
  USER_NOT_FOUND: { statusCode: 404, message: "User not found" },
  PUSH_TOKEN_NOT_FOUND: { statusCode: 404, message: "Push token not found" },
  ACCOUNT_NOT_FOUND: { statusCode: 401, message: "Account no longer exists" },
  ACCOUNT_SUSPENDED: { statusCode: 403, message: "Account is suspended" },
  CANNOT_MODIFY_SELF: { statusCode: 403, message: "You cannot modify your own account here" },
  ROLE_ASSIGNMENT_FORBIDDEN: {
    statusCode: 403,
    message: "You cannot assign this role to the target user",
  },
  STATUS_CHANGE_FORBIDDEN: {
    statusCode: 403,
    message: "You cannot change the status of the target user",
  },
  SCOPE_CHANGE_FORBIDDEN: {
    statusCode: 403,
    message: "You cannot change the scope of the target user",
  },
  USER_DELETE_FORBIDDEN: {
    statusCode: 403,
    message: "You cannot delete the target user",
  },
  LAST_SUPER_ADMIN: {
    statusCode: 409,
    message: "The last active super admin cannot be demoted, suspended, or deleted",
  },
  REGIONAL_SCOPE_REQUIRED: {
    statusCode: 400,
    message: "Region and brand are required for a regional brand owner",
  },
  DEVICE_NOT_FOUND: { statusCode: 404, message: "Device not found" },
  DEVICE_UNAUTHORIZED: { statusCode: 401, message: "Device authentication failed" },
  DEVICE_ALREADY_PAIRED: { statusCode: 409, message: "Device is already paired with another account" },
  DEVICE_REVOKED: { statusCode: 409, message: "Device has been revoked" },
  INVALID_PAIRING_CODE: { statusCode: 400, message: "Invalid pairing code" },
  PAIRING_CODE_EXPIRED: { statusCode: 410, message: "Pairing code has expired" },
  CONVERSATION_NOT_FOUND: { statusCode: 404, message: "Conversation not found" },
  AI_NOT_CONFIGURED: {
    statusCode: 503,
    message: "AI is not configured; add an LLM provider API key",
  },
  AI_CONFIGURATION_INVALID: {
    statusCode: 500,
    message: "AI model routing configuration is invalid",
  },
  AI_PROVIDER_UNAVAILABLE: {
    statusCode: 502,
    message: "The AI provider is temporarily unavailable",
  },
  AI_EMPTY_RESPONSE: {
    statusCode: 502,
    message: "The AI provider returned an empty response",
  },
  AI_MEMORY_UNAVAILABLE: {
    statusCode: 503,
    message: "AI conversation memory is unavailable",
  },
  RAG_NOT_CONFIGURED: {
    statusCode: 503,
    message: "Document search is not configured; add Qdrant and embedding settings",
  },
  TODO_NOT_FOUND: { statusCode: 404, message: "Todo not found" },
  REMINDER_NOT_FOUND: { statusCode: 404, message: "Reminder not found" },
  SCHEDULE_NOT_FOUND: { statusCode: 404, message: "Schedule entry not found" },
  EXAM_NOT_FOUND: { statusCode: 404, message: "Exam not found" },
  PLAN_NOT_FOUND: { statusCode: 404, message: "Study plan not found" },
  DOCUMENT_NOT_FOUND: { statusCode: 404, message: "Document not found" },
  QUIZ_NOT_FOUND: { statusCode: 404, message: "Quiz not found" },
  CONTACT_NOT_FOUND: { statusCode: 404, message: "Contact not found" },
};

const PRISMA_ERRORS: Record<string, { statusCode: number; code: string; message: string }> = {
  P2002: {
    statusCode: 409,
    code: "CONFLICT",
    message: "A record with the same unique value already exists",
  },
  P2003: {
    statusCode: 400,
    code: "INVALID_REFERENCE",
    message: "The request references a record that does not exist",
  },
  P2025: { statusCode: 404, code: "NOT_FOUND", message: "Resource not found" },
};

type ErrorWithMetadata = Error & {
  code?: string;
  status?: number;
  statusCode?: number;
  type?: string;
};

function normalizeError(error: unknown): NormalizedError {
  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      code: "VALIDATION_ERROR",
      message: "Invalid request data",
      details: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
        code: issue.code,
      })),
    };
  }

  if (isAppError(error)) {
    return {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }

  if (error instanceof Error) {
    const metadata = error as ErrorWithMetadata;

    if (metadata.name === "TokenExpiredError") {
      return { statusCode: 401, code: "TOKEN_EXPIRED", message: "Token has expired" };
    }

    if (metadata.name === "JsonWebTokenError" || metadata.name === "NotBeforeError") {
      return { statusCode: 401, code: "INVALID_TOKEN", message: "Invalid token" };
    }

    const domainError = DOMAIN_ERRORS[error.message];
    if (domainError) {
      return {
        statusCode: domainError.statusCode,
        code: error.message,
        message: domainError.message,
      };
    }

    if (metadata.type === "entity.parse.failed") {
      return { statusCode: 400, code: "INVALID_JSON", message: "Request body is not valid JSON" };
    }

    if (metadata.name === "MulterError") {
      if (metadata.code === "LIMIT_FILE_SIZE") {
        return { statusCode: 413, code: "FILE_TOO_LARGE", message: "Uploaded file is too large" };
      }
      return { statusCode: 400, code: "INVALID_UPLOAD", message: "Invalid file upload" };
    }

    const prismaError = metadata.code ? PRISMA_ERRORS[metadata.code] : undefined;
    if (prismaError) {
      return prismaError;
    }

    if (
      typeof metadata.statusCode === "number" &&
      metadata.statusCode >= 400 &&
      metadata.statusCode < 600
    ) {
      return {
        statusCode: metadata.statusCode,
        code: metadata.code ?? "REQUEST_ERROR",
        message: error.message,
      };
    }

    if (typeof metadata.status === "number" && metadata.status >= 400 && metadata.status < 600) {
      return {
        statusCode: metadata.status,
        code: metadata.code ?? "REQUEST_ERROR",
        message: error.message,
      };
    }
  }

  return { statusCode: 500, code: "INTERNAL_ERROR", message: "Internal server error" };
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  const normalized = normalizeError(error);
  const isServerError = normalized.statusCode >= 500;
  const logPayload = {
    requestId: req.id,
    method: req.method,
    url: req.originalUrl,
    statusCode: normalized.statusCode,
    code: normalized.code,
    ...(isServerError ? { err: error } : { message: normalized.message }),
  };

  if (isServerError) {
    logger.error(logPayload, "request failed");
  } else {
    logger.warn(logPayload, "request failed");
  }

  sendError(res, {
    status: normalized.statusCode,
    code: normalized.code,
    message: isServerError ? "Internal server error" : normalized.message,
    details: isServerError ? undefined : normalized.details,
  });
}
