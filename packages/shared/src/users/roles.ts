export const USER_ROLES = [
  "USER",
  "MODERATOR",
  "REGIONAL_BRAND_OWNER",
  "ADMIN",
  "SUPER_ADMIN",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["ACTIVE", "SUSPENDED"] as const;

export type UserStatus = (typeof USER_STATUSES)[number];

export const ROLE_LEVELS: Record<UserRole, number> = {
  USER: 0,
  MODERATOR: 1,
  REGIONAL_BRAND_OWNER: 2,
  ADMIN: 3,
  SUPER_ADMIN: 4,
};

export function isRoleAtLeast(role: UserRole, minimum: UserRole): boolean {
  return ROLE_LEVELS[role] >= ROLE_LEVELS[minimum];
}
