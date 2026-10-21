import { randomUUID } from "node:crypto";
import { NextFunction, Request, Response } from "express";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{8,128}$/;

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header("x-request-id");
  const id = incoming && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();

  req.id = id;
  res.locals.requestId = id;
  res.setHeader("x-request-id", id);

  next();
}
