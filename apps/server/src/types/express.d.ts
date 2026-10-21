import type { UserRole, UserStatus } from "@prisma/client";

export {};

declare global {
  namespace Express {
    interface Request {
      id: string;
      user?: {
        id: string;
        role: UserRole;
        status: UserStatus;
      };
    }
  }
}
