import { DateTime } from "luxon";

export type NudgeType = "TASK" | "EXAM" | "STUDY" | "REMINDER";

export interface NudgeSettings {
  enabled: boolean;
  maxPerDay: number;
  types: {
    reminders: boolean;
    study: boolean;
    exams: boolean;
    tasks: boolean;
  };
}

export interface QuietHours {
  enabled: boolean;
  start: string;
  end: string;
}

export interface NudgeCandidate {
  type: NudgeType;
  title: string;
  body: string;
}

export interface NudgeInput {
  now: Date;
  timezone: string;
  settings: NudgeSettings | null;
  quietHours: QuietHours | null;
  sentToday: number;
  sentTypes: NudgeType[];
  tasks: Array<{ title: string; dueAt: Date | null }>;
  exams: Array<{ title: string; date: Date }>;
  reminders: Array<{ text: string; nextAt: Date | null }>;
  studiedToday: boolean;
}

export function nudgeLocalDay(now: Date, timezone: string): string | null {
  const local = DateTime.fromJSDate(now, { zone: timezone });
  return local.isValid ? local.toISODate() : null;
}

export function nudgeDayBounds(
  now: Date,
  timezone: string
): { start: Date; end: Date } | null {
  const local = DateTime.fromJSDate(now, { zone: timezone });
  if (!local.isValid) {
    return null;
  }

  return { start: local.startOf("day").toJSDate(), end: local.endOf("day").toJSDate() };
}

const ACTIVE_START_MINUTES = 8 * 60;
const ACTIVE_END_MINUTES = 21 * 60;
const STUDY_CHECK_MINUTES = 15 * 60;
const EXAM_WINDOW_DAYS = 7;

export function normalizeNudgeSettings(value: unknown): NudgeSettings | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const types = record.types;
  if (typeof record.enabled !== "boolean" || typeof record.maxPerDay !== "number") {
    return null;
  }
  if (typeof types !== "object" || types === null || Array.isArray(types)) {
    return null;
  }

  const flags = types as Record<string, unknown>;
  if (
    typeof flags.reminders !== "boolean" ||
    typeof flags.study !== "boolean" ||
    typeof flags.exams !== "boolean" ||
    typeof flags.tasks !== "boolean"
  ) {
    return null;
  }

  return {
    enabled: record.enabled,
    maxPerDay: Math.max(0, Math.min(20, Math.floor(record.maxPerDay))),
    types: {
      reminders: flags.reminders,
      study: flags.study,
      exams: flags.exams,
      tasks: flags.tasks,
    },
  };
}

export function normalizeQuietHours(value: unknown): QuietHours | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const time = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (
    typeof record.enabled !== "boolean" ||
    typeof record.start !== "string" ||
    typeof record.end !== "string" ||
    !time.test(record.start) ||
    !time.test(record.end)
  ) {
    return null;
  }

  return {
    enabled: record.enabled,
    start: record.start,
    end: record.end,
  };
}

function minutesOf(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Quiet hours may wrap midnight, e.g. 22:00–07:00. */
export function isWithinQuietHours(
  quietHours: QuietHours | null,
  minutes: number
): boolean {
  if (!quietHours?.enabled) {
    return false;
  }

  const start = minutesOf(quietHours.start);
  const end = minutesOf(quietHours.end);
  if (start === end) {
    return false;
  }

  return start < end
    ? minutes >= start && minutes < end
    : minutes >= start || minutes < end;
}

function isSameLocalDay(a: Date, b: DateTime): boolean {
  return DateTime.fromJSDate(a, { zone: b.zone }).hasSame(b, "day");
}

function daysUntil(date: Date, now: DateTime): number {
  const target = DateTime.fromJSDate(date, { zone: now.zone }).startOf("day");
  return Math.ceil(target.diff(now.startOf("day"), "days").days);
}

export function nudgeCandidates(input: NudgeInput): NudgeCandidate[] {
  const settings = input.settings;
  if (!settings?.enabled || settings.maxPerDay <= 0) {
    return [];
  }

  const now = DateTime.fromJSDate(input.now, { zone: input.timezone });
  if (!now.isValid) {
    return [];
  }

  const minutes = now.hour * 60 + now.minute;
  if (minutes < ACTIVE_START_MINUTES || minutes >= ACTIVE_END_MINUTES) {
    return [];
  }
  if (isWithinQuietHours(input.quietHours, minutes)) {
    return [];
  }

  const remaining = Math.max(0, settings.maxPerDay - input.sentToday);
  if (remaining === 0) {
    return [];
  }

  const sent = new Set(input.sentTypes);
  const candidates: NudgeCandidate[] = [];

  if (settings.types.tasks && !sent.has("TASK")) {
    const due = input.tasks.filter(
      task => task.dueAt && isSameLocalDay(task.dueAt, now)
    );
    const overdue = input.tasks.filter(
      task => task.dueAt && DateTime.fromJSDate(task.dueAt, { zone: now.zone }) < now.startOf("day")
    );
    if (due.length > 0 || overdue.length > 0) {
      const parts: string[] = [];
      if (overdue.length > 0) {
        parts.push(`${overdue.length} overdue`);
      }
      if (due.length > 0) {
        parts.push(`${due.length} due today`);
      }
      candidates.push({
        type: "TASK",
        title: "Tasks waiting",
        body: `${parts.join(" and ")}. Open Robo to plan the rest of the day.`,
      });
    }
  }

  if (settings.types.exams && !sent.has("EXAM")) {
    const upcoming = input.exams
      .map(exam => ({ ...exam, days: daysUntil(exam.date, now) }))
      .filter(exam => exam.days >= 0 && exam.days <= EXAM_WINDOW_DAYS)
      .sort((a, b) => a.days - b.days)[0];
    if (upcoming) {
      candidates.push({
        type: "EXAM",
        title: "Exam coming up",
        body:
          upcoming.days === 0
            ? `${upcoming.title} is today.`
            : `${upcoming.title} is in ${upcoming.days} day${upcoming.days === 1 ? "" : "s"}.`,
      });
    }
  }

  if (settings.types.study && !sent.has("STUDY") && minutes >= STUDY_CHECK_MINUTES) {
    if (!input.studiedToday) {
      candidates.push({
        type: "STUDY",
        title: "Study check-in",
        body: "No study session yet today. Want to start a 25-minute session?",
      });
    }
  }

  if (settings.types.reminders && !sent.has("REMINDER")) {
    const upcoming = input.reminders.filter(
      reminder =>
        reminder.nextAt &&
        reminder.nextAt > input.now &&
        isSameLocalDay(reminder.nextAt, now)
    );
    if (upcoming.length > 0) {
      candidates.push({
        type: "REMINDER",
        title: "Reminders today",
        body: `${upcoming.length} reminder${upcoming.length === 1 ? "" : "s"} still coming up today.`,
      });
    }
  }

  return candidates.slice(0, remaining);
}

export interface NudgeRecord {
  id: string;
  userId: string;
  type: NudgeType;
  localDay: string;
  title: string;
  body: string;
  createdAt: Date;
}
