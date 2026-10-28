import { prisma } from "../lib/prisma";

const RETRY_DELAYS_MS = [60_000, 5 * 60_000];
const MAX_ATTEMPTS = 3;

export type ReminderDeliveryChannel = "device" | "phone" | "push";
export type ReminderDeliveryStatus = "PENDING" | "SENT" | "FAILED";

export interface ReminderDeliveryInput {
  reminderId: string;
  userId: string;
  dueAt: Date;
  channel: ReminderDeliveryChannel;
  status: ReminderDeliveryStatus;
  error?: string | null;
}

/**
 * Upserts one delivery row per reminder occurrence and channel. A retry bumps
 * `attempts` instead of creating a second row, so the latest state is queryable.
 */
export async function recordReminderDelivery(
  input: ReminderDeliveryInput
): Promise<void> {
  const now = new Date();
  const sentAt = input.status === "SENT" ? now : null;
  const existing = await prisma.reminderDelivery.findUnique({
    where: {
      reminderId_dueAt_channel: {
        reminderId: input.reminderId,
        dueAt: input.dueAt,
        channel: input.channel,
      },
    },
    select: { attempts: true },
  });
  const attempts = (existing?.attempts ?? 0) + 1;
  const retryDelay = RETRY_DELAYS_MS[attempts - 1];
  const nextAttemptAt =
    input.status === "FAILED" && attempts < MAX_ATTEMPTS && retryDelay
      ? new Date(now.getTime() + retryDelay)
      : null;

  await prisma.reminderDelivery.upsert({
    where: {
      reminderId_dueAt_channel: {
        reminderId: input.reminderId,
        dueAt: input.dueAt,
        channel: input.channel,
      },
    },
    create: {
      reminderId: input.reminderId,
      userId: input.userId,
      dueAt: input.dueAt,
      channel: input.channel,
      status: input.status,
      attempts,
      error: input.error ?? null,
      nextAttemptAt,
      sentAt,
    },
    update: {
      status: input.status,
      attempts,
      error: input.error ?? null,
      nextAttemptAt,
      sentAt,
    },
  });
}

export interface FailedDeliveryRetry {
  id: string;
  reminderId: string;
  userId: string;
  dueAt: Date;
  channel: ReminderDeliveryChannel;
  attempts: number;
}

export async function listDueDeliveryRetries(
  now: Date,
  limit = 20
): Promise<FailedDeliveryRetry[]> {
  const rows = await prisma.reminderDelivery.findMany({
    where: { status: "FAILED", nextAttemptAt: { lte: now } },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
    select: {
      id: true,
      reminderId: true,
      userId: true,
      dueAt: true,
      channel: true,
      attempts: true,
    },
  });

  return rows.map((row) => ({
    ...row,
    channel: row.channel as ReminderDeliveryChannel,
  }));
}

export interface DeliveryReminder {
  id: string;
  userId: string;
  text: string;
}

export async function getRemindersForDeliveries(
  ids: string[]
): Promise<DeliveryReminder[]> {
  if (ids.length === 0) {
    return [];
  }

  return prisma.reminder.findMany({
    where: { id: { in: ids } },
    select: { id: true, userId: true, text: true },
  });
}

export interface ReminderDeliveryEntry {
  id: string;
  reminderId: string;
  dueAt: Date;
  channel: ReminderDeliveryChannel;
  status: ReminderDeliveryStatus;
  attempts: number;
  error: string | null;
  nextAttemptAt: Date | null;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Recent delivery attempts for the app's activity/debug view. */
export async function getReminderDeliveries(
  userId: string,
  limit = 50
): Promise<ReminderDeliveryEntry[]> {
  const rows = await prisma.reminderDelivery.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    select: {
      id: true,
      reminderId: true,
      dueAt: true,
      channel: true,
      status: true,
      attempts: true,
      error: true,
      nextAttemptAt: true,
      sentAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return rows.map((row) => ({
    ...row,
    channel: row.channel as ReminderDeliveryChannel,
    status: row.status as ReminderDeliveryStatus,
  }));
}

/** Called when a queued device event is finally sent on reconnect. */
export async function markReminderDeliverySent(
  reminderId: string,
  dueAt: Date,
  channel: ReminderDeliveryChannel
): Promise<void> {
  await prisma.reminderDelivery.updateMany({
    where: { reminderId, dueAt, channel, status: { not: "SENT" } },
    data: { status: "SENT", sentAt: new Date(), nextAttemptAt: null, error: null },
  });
}
