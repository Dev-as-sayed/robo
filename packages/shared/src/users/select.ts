import type { User } from "@prisma/client";
import type { UserRole, UserStatus } from "./roles";

export interface PublicUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  status: UserStatus;
  region: string | null;
  brand: string | null;
  locale: string;
  timezone: string;
  quietHours: unknown;
  wakePhrase: string;
  nudgeSettings: unknown;
  cloudAiForDocs: boolean;
  guardianConsent: boolean;
  hasPassword: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminUser extends PublicUser {
  suspendedAt: Date | null;
  suspensionReason: string | null;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    region: user.region,
    brand: user.brand,
    locale: user.locale,
    timezone: user.timezone,
    quietHours: user.quietHours,
    wakePhrase: user.wakePhrase,
    nudgeSettings: user.nudgeSettings,
    cloudAiForDocs: user.cloudAiForDocs,
    guardianConsent: user.guardianConsent,
    hasPassword: Boolean(user.passwordHash),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function toAdminUser(user: User): AdminUser {
  return {
    ...toPublicUser(user),
    suspendedAt: user.suspendedAt,
    suspensionReason: user.suspensionReason,
  };
}
