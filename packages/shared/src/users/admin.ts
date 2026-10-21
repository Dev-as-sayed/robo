import { Prisma, type User } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { revokeAllTokensForUser } from "../auth";
import {
  ROLE_LEVELS,
  USER_ROLES,
  USER_STATUSES,
  type UserRole,
  type UserStatus,
} from "./roles";
import { toAdminUser } from "./select";

interface Actor {
  id: string;
  role: UserRole;
  region: string | null;
  brand: string | null;
}

interface ListUsersQuery {
  cursor?: string;
  limit: number;
  role?: UserRole;
  status?: UserStatus;
  search?: string;
  region?: string;
  brand?: string;
}

interface UpdateRoleInput {
  role: UserRole;
  region?: string | null;
  brand?: string | null;
}

interface UpdateStatusInput {
  status: UserStatus;
  reason?: string;
}

interface UpdateScopeInput {
  region: string | null;
  brand: string | null;
}

function sameScope(actor: Actor, target: Pick<User, "region" | "brand">): boolean {
  return Boolean(
    actor.region && actor.brand && actor.region === target.region && actor.brand === target.brand
  );
}

async function getActor(actorId: string): Promise<Actor> {
  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { id: true, role: true, region: true, brand: true, status: true },
  });

  if (!actor || actor.status !== "ACTIVE") {
    throw new Error("USER_NOT_FOUND");
  }

  return actor;
}

function scopeFilter(actor: Actor): Prisma.UserWhereInput {
  if (actor.role === "ADMIN" || actor.role === "SUPER_ADMIN") {
    return {};
  }

  if (actor.role === "MODERATOR") {
    return { role: "USER" };
  }

  if (actor.role === "REGIONAL_BRAND_OWNER") {
    if (!actor.region || !actor.brand) {
      return { id: { in: [] } };
    }

    return {
      region: actor.region,
      brand: actor.brand,
      role: { in: ["USER", "MODERATOR"] },
    };
  }

  return { id: { in: [] } };
}

function canView(actor: Actor, target: User): boolean {
  if (actor.role === "ADMIN" || actor.role === "SUPER_ADMIN") {
    return true;
  }

  if (actor.role === "MODERATOR") {
    return target.role === "USER";
  }

  if (actor.role === "REGIONAL_BRAND_OWNER") {
    return sameScope(actor, target) && ROLE_LEVELS[target.role] < ROLE_LEVELS.REGIONAL_BRAND_OWNER;
  }

  return false;
}

function canAssignRole(actor: Actor, target: User, role: UserRole): boolean {
  if (target.id === actor.id) {
    return false;
  }

  if (actor.role === "SUPER_ADMIN") {
    return true;
  }

  if (actor.role === "ADMIN") {
    return (
      ROLE_LEVELS[target.role] < ROLE_LEVELS.ADMIN &&
      ROLE_LEVELS[role] < ROLE_LEVELS.ADMIN
    );
  }

  if (actor.role === "REGIONAL_BRAND_OWNER") {
    return (
      sameScope(actor, target) &&
      ROLE_LEVELS[target.role] < ROLE_LEVELS.REGIONAL_BRAND_OWNER &&
      ROLE_LEVELS[role] < ROLE_LEVELS.REGIONAL_BRAND_OWNER
    );
  }

  return false;
}

function canSetStatus(actor: Actor, target: User): boolean {
  if (target.id === actor.id) {
    return false;
  }

  if (actor.role === "SUPER_ADMIN") {
    return true;
  }

  if (actor.role === "ADMIN") {
    return ROLE_LEVELS[target.role] < ROLE_LEVELS.ADMIN;
  }

  if (actor.role === "REGIONAL_BRAND_OWNER") {
    return sameScope(actor, target) && ROLE_LEVELS[target.role] < ROLE_LEVELS.REGIONAL_BRAND_OWNER;
  }

  if (actor.role === "MODERATOR") {
    return target.role === "USER";
  }

  return false;
}

function canSetScope(actor: Actor, target: User): boolean {
  if (actor.role === "SUPER_ADMIN") {
    return true;
  }

  if (actor.role === "ADMIN") {
    return ROLE_LEVELS[target.role] < ROLE_LEVELS.ADMIN;
  }

  return false;
}

function canDelete(actor: Actor, target: User): boolean {
  if (target.id === actor.id) {
    return false;
  }

  if (actor.role === "SUPER_ADMIN") {
    return true;
  }

  if (actor.role === "ADMIN") {
    return ROLE_LEVELS[target.role] < ROLE_LEVELS.ADMIN;
  }

  return false;
}

async function ensureNotLastActiveSuperAdmin(target: User): Promise<void> {
  if (target.role !== "SUPER_ADMIN" || target.status !== "ACTIVE") {
    return;
  }

  const remaining = await prisma.user.count({
    where: {
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      id: { not: target.id },
    },
  });

  if (remaining === 0) {
    throw new Error("LAST_SUPER_ADMIN");
  }
}

async function getVisibleTarget(actor: Actor, targetId: string): Promise<User> {
  const target = await prisma.user.findUnique({ where: { id: targetId } });

  if (!target || !canView(actor, target)) {
    throw new Error("USER_NOT_FOUND");
  }

  return target;
}

export async function listUsers(actorId: string, query: ListUsersQuery) {
  const actor = await getActor(actorId);
  const conditions: Prisma.UserWhereInput[] = [scopeFilter(actor)];

  if (query.role) {
    conditions.push({ role: query.role });
  }

  if (query.status) {
    conditions.push({ status: query.status });
  }

  if (query.region) {
    conditions.push({ region: query.region });
  }

  if (query.brand) {
    conditions.push({ brand: query.brand });
  }

  if (query.search) {
    conditions.push({
      OR: [
        { email: { contains: query.search, mode: "insensitive" } },
        { name: { contains: query.search, mode: "insensitive" } },
      ],
    });
  }

  const where: Prisma.UserWhereInput = { AND: conditions };
  const users = await prisma.user.findMany({
    where,
    take: query.limit + 1,
    orderBy: { id: "asc" },
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });

  const hasMore = users.length > query.limit;
  const page = hasMore ? users.slice(0, query.limit) : users;

  return {
    users: page.map(toAdminUser),
    nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    hasMore,
  };
}

export async function getUserStats(actorId: string) {
  const actor = await getActor(actorId);
  const where = scopeFilter(actor);

  const [total, roleGroups, statusGroups] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.groupBy({ by: ["role"], where, _count: true }),
    prisma.user.groupBy({ by: ["status"], where, _count: true }),
  ]);

  const byRole = Object.fromEntries(USER_ROLES.map((role) => [role, 0])) as Record<
    UserRole,
    number
  >;
  const byStatus = Object.fromEntries(USER_STATUSES.map((status) => [status, 0])) as Record<
    UserStatus,
    number
  >;

  for (const group of roleGroups) {
    byRole[group.role] = group._count;
  }

  for (const group of statusGroups) {
    byStatus[group.status] = group._count;
  }

  return { total, byRole, byStatus };
}

export async function getUserById(actorId: string, targetId: string) {
  const actor = await getActor(actorId);
  const target = await getVisibleTarget(actor, targetId);
  return toAdminUser(target);
}

export async function updateUserRole(
  actorId: string,
  targetId: string,
  input: UpdateRoleInput
) {
  const actor = await getActor(actorId);
  const target = await getVisibleTarget(actor, targetId);

  if (target.id === actor.id) {
    throw new Error("CANNOT_MODIFY_SELF");
  }

  if (!canAssignRole(actor, target, input.role)) {
    throw new Error("ROLE_ASSIGNMENT_FORBIDDEN");
  }

  const region = input.region !== undefined ? input.region : target.region;
  const brand = input.brand !== undefined ? input.brand : target.brand;

  if (input.role === "REGIONAL_BRAND_OWNER" && (!region || !brand)) {
    throw new Error("REGIONAL_SCOPE_REQUIRED");
  }

  if (target.role === "SUPER_ADMIN" && input.role !== "SUPER_ADMIN") {
    await ensureNotLastActiveSuperAdmin(target);
  }

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: {
      role: input.role,
      ...(input.region !== undefined ? { region: input.region } : {}),
      ...(input.brand !== undefined ? { brand: input.brand } : {}),
    },
  });

  return toAdminUser(updated);
}

export async function updateUserStatus(
  actorId: string,
  targetId: string,
  input: UpdateStatusInput
) {
  const actor = await getActor(actorId);
  const target = await getVisibleTarget(actor, targetId);

  if (target.id === actor.id) {
    throw new Error("CANNOT_MODIFY_SELF");
  }

  if (!canSetStatus(actor, target)) {
    throw new Error("STATUS_CHANGE_FORBIDDEN");
  }

  if (input.status === "SUSPENDED") {
    await ensureNotLastActiveSuperAdmin(target);
  }

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: {
      status: input.status,
      suspendedAt: input.status === "SUSPENDED" ? new Date() : null,
      suspensionReason: input.status === "SUSPENDED" ? (input.reason ?? null) : null,
    },
  });

  if (input.status === "SUSPENDED") {
    await revokeAllTokensForUser(target.id);
  }

  return toAdminUser(updated);
}

export async function updateUserScope(
  actorId: string,
  targetId: string,
  input: UpdateScopeInput
) {
  const actor = await getActor(actorId);
  const target = await getVisibleTarget(actor, targetId);

  if (!canSetScope(actor, target)) {
    throw new Error("SCOPE_CHANGE_FORBIDDEN");
  }

  if (target.role === "REGIONAL_BRAND_OWNER" && (!input.region || !input.brand)) {
    throw new Error("REGIONAL_SCOPE_REQUIRED");
  }

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: { region: input.region, brand: input.brand },
  });

  return toAdminUser(updated);
}

export async function deleteUser(actorId: string, targetId: string) {
  const actor = await getActor(actorId);
  const target = await getVisibleTarget(actor, targetId);

  if (target.id === actor.id) {
    throw new Error("CANNOT_MODIFY_SELF");
  }

  if (!canDelete(actor, target)) {
    throw new Error("USER_DELETE_FORBIDDEN");
  }

  await ensureNotLastActiveSuperAdmin(target);
  await prisma.user.delete({ where: { id: target.id } });

  return { deleted: true, id: target.id };
}
