export interface AppErrorOptions {
  statusCode?: number;
  code?: string;
  details?: unknown;
  cause?: unknown;
}

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;
  readonly isOperational = true;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = new.target.name;
    this.statusCode = options.statusCode ?? 500;
    this.code = options.code ?? "INTERNAL_ERROR";
    this.details = options.details;
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request", code = "BAD_REQUEST", details?: unknown) {
    super(message, { statusCode: 400, code, details });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required", code = "UNAUTHORIZED") {
    super(message, { statusCode: 401, code });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action", code = "FORBIDDEN") {
    super(message, { statusCode: 403, code });
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found", code = "NOT_FOUND") {
    super(message, { statusCode: 404, code });
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource already exists", code = "CONFLICT") {
    super(message, { statusCode: 409, code });
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = "Too many requests, please try again later", code = "RATE_LIMITED") {
    super(message, { statusCode: 429, code });
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
