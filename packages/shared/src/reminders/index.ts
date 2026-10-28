import { tzOffsetMinutes } from "../lib/time";
import { prisma } from "../lib/prisma";
export * from "./deliveries";
import { nextOccurrence } from "./rrule";

export * from "./rrule";
export { tzOffsetMinutes } from "../lib/time";

/**
 * The next instant a reminder should fire. Recurring rules advance from their own
 * anchor; a one-off reminder fires at `at` but only while that is still ahead of
 * `from`, so a past-dated task never fires again.
 */
export function computeReminderNextAt(
  reminder: { at: Date | null; rrule: string | null },
  from: Date,
  timezone?: string | null
): Date | null {
  if (reminder.rrule && reminder.at) {
    const next = nextOccurrence({
      rrule: reminder.rrule,
      dtstart: reminder.at,
      after: from,
      offsetMinutes: tzOffsetMinutes(timezone, from),
      ...(timezone ? { timezone } : {}),
    });
    if (next) return next;
  }

  if (reminder.at && reminder.at.getTime() > from.getTime()) return reminder.at;

  return null;
}

export interface Reminder {
  id: string;
  userId: string;
  text: string;
  at: Date | null;
  rrule: string | null;
  nextAt: Date | null;
  lastFiredAt: Date | null;
  channels: ("device" | "phone" | "push")[];
  linkedEntity: "todo" | "exam" | "schedule" | null;
  status: "active" | "completed" | "snoozed" | "expired";
  createdAt: Date;
  updatedAt: Date;
}

const reminderSelect = {
  id: true,
  userId: true,
  text: true,
  at: true,
  rrule: true,
  nextAt: true,
  lastFiredAt: true,
  channels: true,
  linkedEntity: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

async function timezoneOf(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });

  return user?.timezone ?? null;
}

export async function createReminder(
  userId: string,
  data: {
    text: string;
    at?: Date;
    rrule?: string;
    channels?: ("device" | "phone" | "push")[];
    linkedEntity?: "todo" | "exam" | "schedule";
  }
) {
  const timezone = await timezoneOf(userId);
  const at = data.at ?? null;
  const rrule = data.rrule ?? null;

  return await prisma.reminder.create({
    data: {
      userId,
      text: data.text,
      at,
      rrule,
      nextAt: computeReminderNextAt({ at, rrule }, new Date(), timezone),
      channels: data.channels ?? ["device", "phone", "push"],
      linkedEntity: data.linkedEntity,
      status: "active",
    },
    select: reminderSelect,
  });
}

export async function getReminders(
  userId: string,
  filters: {
    status?: string;
    channel?: string;
  }
) {
  const where: any = { userId };

  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.channel) {
    where.channels = { has: filters.channel };
  }

  return await prisma.reminder.findMany({
    where,
    orderBy: { nextAt: "asc" },
    select: reminderSelect,
  });
}

export async function updateReminder(
  userId: string,
  reminderId: string,
  data: {
    text?: string;
    at?: Date | null;
    rrule?: string | null;
    channels?: ("device" | "phone" | "push")[];
    linkedEntity?: "todo" | "exam" | "schedule" | null;
    status?: "active" | "completed" | "snoozed" | "expired";
  }
) {
  const current = await prisma.reminder.findFirst({
    where: { id: reminderId, userId },
    select: { at: true, rrule: true },
  });

  if (!current) {
    throw new Error("REMINDER_NOT_FOUND");
  }

  const at = data.at !== undefined ? data.at : current.at;
  const rrule = data.rrule !== undefined ? data.rrule : current.rrule;
  const status = data.status;

  const patch: Record<string, unknown> = { ...data };

  // Only a reminder that is waiting to fire needs a next slot; a finished one must
  // not keep a stale date, or the scheduler would pick it up again.
  patch.nextAt =
    status && status !== "active"
      ? null
      : computeReminderNextAt({ at, rrule }, new Date(), await timezoneOf(userId));

  return await prisma.reminder.update({
    where: { id: reminderId, userId },
    data: patch,
    select: reminderSelect,
  });
}

export async function deleteReminder(userId: string, reminderId: string) {
  return await prisma.reminder.delete({
    where: { id: reminderId, userId },
  });
}

/**
 * Snoozing delays a reminder instead of parking it. A status-only change leaves it
 * inactive forever, so the next slot moves: recurring rules skip the occurrence that
 * is due and keep their original anchor, one-offs are pushed back by `minutes`.
 */
export async function snoozeReminder(userId: string, reminderId: string, minutes = 10) {
  const current = await prisma.reminder.findFirst({
    where: { id: reminderId, userId },
    select: { at: true, rrule: true, nextAt: true },
  });

  if (!current) {
    throw new Error("REMINDER_NOT_FOUND");
  }

  const now = new Date();
  const delay = Math.max(1, Math.floor(minutes));
  const at = current.rrule ? current.at : new Date(now.getTime() + delay * 60_000);
  const from = current.rrule ? (current.nextAt ?? now) : now;

  return await prisma.reminder.update({
    where: { id: reminderId, userId },
    data: {
      at,
      status: "active",
      nextAt: computeReminderNextAt({ at, rrule: current.rrule }, from, await timezoneOf(userId)),
    },
    select: reminderSelect,
  });
}

export interface DueReminder {
  id: string;
  userId: string;
  timezone: string | null;
  text: string;
  at: Date | null;
  rrule: string | null;
  channels: string[];
  linkedEntity: string | null;
  /** The slot that was claimed, so the caller can report how late delivery was. */
  dueAt: Date;
  firedAt: Date;
}

/**
 * Claims every reminder whose slot has passed and moves it out of the due set in the
 * same step. The `nextAt` in the WHERE clause is the guard: if another process already
 * advanced this row the update matches zero rows and the reminder is delivered once.
 * Advancing before delivery means a crash costs one notification rather than causing a
 * resend loop.
 */
export async function claimDueReminders(now: Date, limit = 50): Promise<DueReminder[]> {
  const candidates = await prisma.reminder.findMany({
    where: { status: "active", nextAt: { lte: now } },
    orderBy: { nextAt: "asc" },
    take: limit,
    select: {
      id: true,
      userId: true,
      text: true,
      at: true,
      rrule: true,
      channels: true,
      linkedEntity: true,
      nextAt: true,
      user: { select: { timezone: true } },
    },
  });

  const claimed: DueReminder[] = [];

  for (const candidate of candidates) {
    if (!candidate.nextAt) continue;

    const timezone = candidate.user.timezone;
    const recurring = Boolean(candidate.rrule && candidate.at);
    const nextAt = recurring
      ? computeReminderNextAt({ at: candidate.at, rrule: candidate.rrule }, now, timezone)
      : null;

    const updated = await prisma.reminder.updateMany({
      where: {
        id: candidate.id,
        status: "active",
        nextAt: candidate.nextAt,
      },
      data: recurring
        ? { lastFiredAt: now, nextAt }
        : { lastFiredAt: now, nextAt: null, status: "completed" },
    });

    if (updated.count !== 1) continue;

    claimed.push({
      id: candidate.id,
      userId: candidate.userId,
      timezone,
      text: candidate.text,
      at: candidate.at,
      rrule: candidate.rrule,
      channels: candidate.channels,
      linkedEntity: candidate.linkedEntity,
      dueAt: candidate.nextAt,
      firedAt: now,
    });
  }

  return claimed;
}
