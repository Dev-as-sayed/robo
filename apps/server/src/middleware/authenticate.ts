import { NextFunction, Request, Response } from "express";
import { getAccountState } from "@robo/shared/users";
import { verifyAccessToken } from "@robo/shared/auth";
import { ForbiddenError, UnauthorizedError } from "../errors/app-error";

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authorization = req.header("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    next(new UnauthorizedError("Authentication required", "MISSING_AUTH_TOKEN"));
    return;
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    next(new UnauthorizedError("Authentication required", "MISSING_AUTH_TOKEN"));
    return;
  }

  try {
    const payload = verifyAccessToken(token);

    if (!payload.sub) {
      next(new UnauthorizedError("Invalid token", "INVALID_TOKEN"));
      return;
    }

    const account = await getAccountState(payload.sub);

    if (!account) {
      next(new UnauthorizedError("Account no longer exists", "ACCOUNT_NOT_FOUND"));
      return;
    }

    if (account.status !== "ACTIVE") {
      next(new ForbiddenError("Account is suspended", "ACCOUNT_SUSPENDED"));
      return;
    }

    req.user = { id: account.id, role: account.role, status: account.status };
    next();
  } catch (error) {
    next(error);
  }
}
