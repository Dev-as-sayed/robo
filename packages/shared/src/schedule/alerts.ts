import { dayKey, tzOffsetMinutes } from "../lib/time";
import { prisma } from "../lib/prisma";

/** How early a class is announced when the class itself does not say. */
export const DEFAULT_CLASS_ALERT_LEAD_MINUTES = 10;

export interface AlertSource {
  startAt: Date | null;
  allDay: boolean;
  alertLeadMinutes?: number | null;
}

/**
 * When to announce a class. All-day blocks and classes that have already started get
 * no slot: announcing them would be noise, and the scheduler would fire it immediately.
 */
export function computeAlertAt(
  entry: AlertSource,
  now: Date = new Date(),
  defaultLeadMinutes: number = DEFAULT_CLASS_ALERT_LEAD_MINUTES
): Date | null {
  if (entry.allDay || !entry.startAt) return null;
  if (entry.startAt.getTime() <= now.getTime()) return null;

  const lead = entry.alertLeadMinutes ?? defaultLeadMinutes;

  return new Date(entry.startAt.getTime() - lead * 60_000);
}

/**
 * True when an exception exists for the calendar day the class starts on, in the user's
 * own timezone. Any exception suppresses the alert — including "moved", because the new
 * time is expressed by editing the entry, not by the exception record.
 */
export function isCancelledOnDay(
  startAt: Date,
  exceptionDates: readonly Date[],
  offsetMinutes = 0
): boolean {
  const classDay = dayKey(startAt, offsetMinutes);

  return exceptionDates.some(date => dayKey(date, offsetMinutes) === classDay);
}

export interface DueClass {
  id: string;
  userId: string;
  timezone: string | null;
  title: string;
  subject: string | null;
  room: string | null;
  startsAt: Date;
  /** The slot that was claimed, so lateness can be measured. */
  dueAt: Date;
  firedAt: Date;
}

/**
 * Claims classes whose alert slot has passed. A class covered by an exception is marked
 * alerted without being delivered, so a cancelled class leaves the due set instead of
 * being re-checked on every tick.
 */
export async function claimDueClassAlerts(
  now: Date,
  limit = 50
): Promise<DueClass[]> {
  const candidates = await prisma.scheduleEntry.findMany({
    where: {
      allDay: false,
      alertedAt: null,
      alertAt: { not: null, lte: now },
    },
    orderBy: { alertAt: "asc" },
    take: limit,
    select: {
      id: true,
      userId: true,
      title: true,
      subject: true,
      room: true,
      startAt: true,
      alertAt: true,
      alertLeadMinutes: true,
      user: { select: { timezone: true } },
      exceptions: { select: { date: true } },
    },
  });

  const claimed: DueClass[] = [];

  for (const candidate of candidates) {
    if (!candidate.alertAt || !candidate.startAt) continue;

    const timezone = candidate.user.timezone;
    const offsetMinutes = tzOffsetMinutes(timezone, now);

    if (isCancelledOnDay(candidate.startAt, candidate.exceptions.map(row => row.date), offsetMinutes)) {
      await prisma.scheduleEntry.updateMany({
        where: { id: candidate.id, alertedAt: null },
        data: { alertedAt: now },
      });
      continue;
    }

    // A late lead can put the slot before the class is even saved with a future start;
    // an alert after the bell is pointless.
    if (candidate.startAt.getTime() <= now.getTime()) {
      await prisma.scheduleEntry.updateMany({
        where: { id: candidate.id, alertedAt: null },
        data: { alertedAt: now },
      });
      continue;
    }

    const updated = await prisma.scheduleEntry.updateMany({
      where: { id: candidate.id, alertedAt: null, alertAt: candidate.alertAt },
      data: { alertedAt: now },
    });

    if (updated.count !== 1) continue;

    claimed.push({
      id: candidate.id,
      userId: candidate.userId,
      timezone,
      title: candidate.title,
      subject: candidate.subject,
      room: candidate.room,
      startsAt: candidate.startAt,
      dueAt: candidate.alertAt,
      firedAt: now,
    });
  }

  return claimed;
}
