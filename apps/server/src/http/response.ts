import { Response } from "express";

export interface SuccessResponseOptions<T> {
  status?: number;
  code: string;
  message?: string;
  data?: T;
}

export interface ErrorResponseOptions {
  status?: number;
  code: string;
  message: string;
  details?: unknown;
}

function getRequestId(res: Response): string | undefined {
  return typeof res.locals.requestId === "string" ? res.locals.requestId : undefined;
}

export function sendSuccess<T>(res: Response, options: SuccessResponseOptions<T>): void {
  const requestId = getRequestId(res);

  res.status(options.status ?? 200).json({
    success: true,
    code: options.code,
    ...(options.message ? { message: options.message } : {}),
    ...(options.data !== undefined ? { data: options.data } : {}),
    ...(requestId ? { requestId } : {}),
  });
}

export function sendError(res: Response, options: ErrorResponseOptions): void {
  const requestId = getRequestId(res);

  res.status(options.status ?? 500).json({
    success: false,
    code: options.code,
    message: options.message,
    ...(options.details !== undefined ? { details: options.details } : {}),
    ...(requestId ? { requestId } : {}),
  });
}
