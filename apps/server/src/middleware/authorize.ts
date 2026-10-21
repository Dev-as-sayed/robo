import type { RequestHandler } from "express";
import { isRoleAtLeast, type UserRole } from "@robo/shared/users";
import { ForbiddenError, UnauthorizedError } from "../errors/app-error";

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new ForbiddenError("Insufficient role", "ROLE_REQUIRED"));
      return;
    }

    next();
  };
}

export function requireMinimumRole(minimum: UserRole): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }

    if (!isRoleAtLeast(req.user.role, minimum)) {
      next(new ForbiddenError("Insufficient role", "ROLE_REQUIRED"));
      return;
    }

    next();
  };
}
