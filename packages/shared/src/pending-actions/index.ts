import { prisma } from "../lib/prisma";

export const PENDING_ACTION_TTL_MS = 5 * 60_000;

export type PendingActionKind = "CALL" | "MESSAGE" | "EMAIL" | "WHATSAPP";
export type PendingActionStatus = "PENDING" | "CONFIRMED" | "REJECTED" | "EXPIRED";

export interface PendingAction {
  id: string;
  userId: string;
  contactId: string | null;
  kind: PendingActionKind;
  recipientName: string;
  recipientPhone: string | null;
  recipientEmail: string | null;
  body: string | null;
  status: PendingActionStatus;
  expiresAt: Date;
  confirmedAt: Date | null;
  rejectedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PendingActionWithUri extends PendingAction {
  uri: string;
}

export interface CreatePendingActionInput {
  kind: PendingActionKind;
  contactId?: string;
  recipientName?: string;
  recipientPhone?: string;
  recipientEmail?: string;
  body?: string;
}

const select = {
  id: true,
  userId: true,
  contactId: true,
  kind: true,
  recipientName: true,
  recipientPhone: true,
  recipientEmail: true,
  body: true,
  status: true,
  expiresAt: true,
  confirmedAt: true,
  rejectedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

function requirePhone(action: Pick<PendingAction, "recipientPhone">): string {
  if (!action.recipientPhone?.trim()) {
    throw new Error("PENDING_ACTION_MISSING_PHONE");
  }

  return action.recipientPhone.trim();
}

function requireEmail(action: Pick<PendingAction, "recipientEmail">): string {
  if (!action.recipientEmail?.trim()) {
    throw new Error("PENDING_ACTION_MISSING_EMAIL");
  }

  return action.recipientEmail.trim();
}

export function pendingActionUri(
  action: Pick<PendingAction, "kind" | "recipientPhone" | "recipientEmail" | "body">
): string {
  switch (action.kind) {
    case "CALL": {
      const phone = requirePhone(action);
      return `tel:${phone.replace(/[^\d+]/g, "")}`;
    }
    case "MESSAGE": {
      const phone = requirePhone(action);
      const suffix = action.body ? `?body=${encodeURIComponent(action.body)}` : "";
      return `sms:${phone.replace(/[^\d+]/g, "")}${suffix}`;
    }
    case "EMAIL": {
      const email = requireEmail(action);
      const subject = encodeURIComponent("Message from Robo");
      const body = action.body ? `&body=${encodeURIComponent(action.body)}` : "";
      return `mailto:${email}?subject=${subject}${body}`;
    }
    case "WHATSAPP": {
      const phone = digits(requirePhone(action));
      const suffix = action.body ? `?text=${encodeURIComponent(action.body)}` : "";
      return `https://wa.me/${phone}${suffix}`;
    }
  }
}

type PendingActionStore = typeof prisma;

export async function createPendingAction(
  userId: string,
  input: CreatePendingActionInput,
  now: Date = new Date(),
  client: PendingActionStore = prisma
): Promise<PendingAction> {
  let contact: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  } | null = null;

  if (input.contactId) {
    contact = await client.contact.findFirst({
      where: { id: input.contactId, userId },
      select: { id: true, name: true, phone: true, email: true },
    });

    if (!contact) {
      throw new Error("CONTACT_NOT_FOUND");
    }
  }

  const recipientName = input.recipientName?.trim() || contact?.name;
  if (!recipientName) {
    throw new Error("PENDING_ACTION_RECIPIENT_REQUIRED");
  }

  const recipientPhone = input.recipientPhone?.trim() || contact?.phone || null;
  const recipientEmail = input.recipientEmail?.trim() || contact?.email || null;
  const body = input.body?.trim() || null;

  if ((input.kind === "CALL" || input.kind === "MESSAGE" || input.kind === "WHATSAPP") && !recipientPhone) {
    throw new Error("PENDING_ACTION_MISSING_PHONE");
  }
  if (input.kind === "EMAIL" && !recipientEmail) {
    throw new Error("PENDING_ACTION_MISSING_EMAIL");
  }
  if ((input.kind === "MESSAGE" || input.kind === "EMAIL" || input.kind === "WHATSAPP") && !body) {
    throw new Error("PENDING_ACTION_BODY_REQUIRED");
  }

  return client.pendingAction.create({
    data: {
      userId,
      contactId: contact?.id,
      kind: input.kind,
      recipientName,
      recipientPhone,
      recipientEmail,
      body,
      expiresAt: new Date(now.getTime() + PENDING_ACTION_TTL_MS),
    },
    select,
  });
}

export async function expirePendingActions(
  now: Date = new Date(),
  userId?: string,
  client: PendingActionStore = prisma
): Promise<number> {
  const result = await client.pendingAction.updateMany({
    where: {
      status: "PENDING",
      expiresAt: { lte: now },
      ...(userId ? { userId } : {}),
    },
    data: { status: "EXPIRED" },
  });

  return result.count;
}

export async function listPendingActions(
  userId: string,
  now: Date = new Date(),
  client: PendingActionStore = prisma
): Promise<PendingAction[]> {
  await expirePendingActions(now, userId, client);

  return client.pendingAction.findMany({
    where: { userId, status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: 20,
    select,
  });
}

async function resolve(
  userId: string,
  actionId: string,
  next: "CONFIRMED" | "REJECTED",
  now: Date,
  client: PendingActionStore
): Promise<PendingAction> {
  const updated = await client.pendingAction.updateMany({
    where: {
      id: actionId,
      userId,
      status: "PENDING",
      expiresAt: { gt: now },
    },
    data:
      next === "CONFIRMED"
        ? { status: "CONFIRMED", confirmedAt: now }
        : { status: "REJECTED", rejectedAt: now },
  });

  if (updated.count === 0) {
    const current = await client.pendingAction.findFirst({
      where: { id: actionId, userId },
      select: { status: true, expiresAt: true },
    });

    if (!current) {
      throw new Error("PENDING_ACTION_NOT_FOUND");
    }
    if (current.status === "EXPIRED") {
      throw new Error("PENDING_ACTION_EXPIRED");
    }
    if (current.status === "PENDING") {
      await client.pendingAction.updateMany({
        where: { id: actionId, userId, status: "PENDING" },
        data: { status: "EXPIRED" },
      });
      throw new Error("PENDING_ACTION_EXPIRED");
    }

    throw new Error("PENDING_ACTION_ALREADY_RESOLVED");
  }

  const action = await client.pendingAction.findFirst({
    where: { id: actionId, userId },
    select,
  });

  if (!action) {
    throw new Error("PENDING_ACTION_NOT_FOUND");
  }

  return action;
}

export async function confirmPendingAction(
  userId: string,
  actionId: string,
  now: Date = new Date(),
  client: PendingActionStore = prisma
): Promise<PendingActionWithUri> {
  const action = await resolve(userId, actionId, "CONFIRMED", now, client);
  return { ...action, uri: pendingActionUri(action) };
}

export async function rejectPendingAction(
  userId: string,
  actionId: string,
  now: Date = new Date(),
  client: PendingActionStore = prisma
): Promise<PendingAction> {
  return resolve(userId, actionId, "REJECTED", now, client);
}
