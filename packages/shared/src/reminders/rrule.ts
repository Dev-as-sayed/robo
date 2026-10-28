import { DateTime } from "luxon";

/**
 * A deliberately small subset of RFC 5545 recurrence rules.
 *
 * Supported: FREQ=DAILY|WEEKLY|MONTHLY, INTERVAL, BYDAY (WEEKLY only), COUNT, UNTIL.
 * A rule containing anything it does not understand returns null, so callers fall
 * back to a one-off reminder instead of silently mis-firing.
 *
 * Recurrence is defined against a wall clock. Passing `timezone` makes stepping
 * DST-correct: each occurrence is rebuilt from local calendar parts in that IANA
 * zone. `offsetMinutes` remains for callers that only have a fixed offset and for
 * the existing stored rules.
 */

export type RruleFreq = "DAILY" | "WEEKLY" | "MONTHLY";

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** Bounds enumeration so an unsatisfiable rule cannot spin forever. */
const MAX_OCCURRENCES = 1000;

/** RRULE weekday codes mapped to Date#getUTCDay values. */
const WEEKDAY_CODES: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

export interface ParsedRrule {
  freq: RruleFreq;
  interval: number;
  byDay: number[];
  count: number | null;
  /** Wall-clock milliseconds, already shifted by the caller's offset. */
  untilWallMs: number | null;
}

function isFreq(value: string): value is RruleFreq {
  return value === "DAILY" || value === "WEEKLY" || value === "MONTHLY";
}

/**
 * UNTIL is either a Zulu timestamp (absolute, so the offset is applied to read it on
 * the wall) or a floating timestamp (already local, so it is read as-is).
 */
function parseUntil(value: string, offsetMinutes: number): number | null {
  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value);
  if (!match) return null;

  const [, year, month, day, hour, minute, second, zulu] = match;
  const naive = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour ?? 0),
    Number(minute ?? 0),
    Number(second ?? 0)
  );

  return zulu ? naive + offsetMinutes * MINUTE_MS : naive;
}

export function parseRrule(rrule: string, offsetMinutes = 0): ParsedRrule | null {
  const cleaned = rrule.trim().replace(/^RRULE:/i, "");
  if (!cleaned) return null;

  let freq: RruleFreq | null = null;
  let interval = 1;
  let byDay: number[] = [];
  let count: number | null = null;
  let untilWallMs: number | null = null;

  for (const part of cleaned.split(";")) {
    const [rawKey, rawValue] = part.split("=");
    const key = (rawKey ?? "").trim().toUpperCase();
    const value = (rawValue ?? "").trim().toUpperCase();
    if (!key || !value) continue;

    if (key === "FREQ") {
      if (!isFreq(value)) return null;
      freq = value;
    } else if (key === "INTERVAL") {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 1) return null;
      interval = parsed;
    } else if (key === "BYDAY") {
      const codes = value.split(",");
      // Ordinal weekdays (2MO, -1FR) need month position maths this engine lacks.
      if (codes.some(code => /^[+-]?\d/.test(code))) return null;
      const days = codes
        .map(code => WEEKDAY_CODES[code])
        .filter((day): day is number => day !== undefined);
      if (days.length !== codes.length) return null;
      byDay = [...new Set(days)].sort((a, b) => a - b);
    } else if (key === "COUNT") {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 1) return null;
      count = parsed;
    } else if (key === "UNTIL") {
      untilWallMs = parseUntil(value, offsetMinutes);
      if (untilWallMs === null) return null;
    } else {
      // Unsupported part (BYMONTHDAY, WKST, RSCALE, ...): refuse rather than guess.
      return null;
    }
  }

  if (!freq) return null;
  // BYDAY is only meaningful for the weekly rule this engine steps by week.
  if (byDay.length && freq !== "WEEKLY") return null;

  return { freq, interval, byDay, count, untilWallMs };
}

function wallMsOf(instant: Date, offsetMinutes: number): number {
  return instant.getTime() + offsetMinutes * MINUTE_MS;
}

function instantFromWallMs(wallMs: number, offsetMinutes: number): Date {
  return new Date(wallMs - offsetMinutes * MINUTE_MS);
}

/** Local calendar parts encoded as if they were UTC, so day stepping stays simple. */
function localWallMs(instant: Date, timezone: string): number {
  const local = DateTime.fromJSDate(instant, { zone: timezone });
  if (!local.isValid) return instant.getTime();

  return Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second,
    local.millisecond
  );
}

/**
 * Rebuilds an instant from local wall parts in `timezone`. Luxon applies the offset
 * that is in force on that date, which is what keeps a daily 09:00 reminder at 09:00
 * across a DST transition instead of drifting to 08:00 or 10:00.
 */
function instantFromLocalWallMs(wallMs: number, timezone: string): Date {
  const wall = new Date(wallMs);
  const local = DateTime.fromObject(
    {
      year: wall.getUTCFullYear(),
      month: wall.getUTCMonth() + 1,
      day: wall.getUTCDate(),
      hour: wall.getUTCHours(),
      minute: wall.getUTCMinutes(),
      second: wall.getUTCSeconds(),
      millisecond: wall.getUTCMilliseconds(),
    },
    { zone: timezone }
  );

  return local.isValid ? local.toJSDate() : new Date(wallMs);
}

/** Monday-anchored, matching how school timetables group a week. */
function weekStartWallMs(wallMs: number): number {
  const dayStart = Math.floor(wallMs / DAY_MS) * DAY_MS;
  const sinceMonday = (new Date(dayStart).getUTCDay() + 6) % 7;
  return dayStart - sinceMonday * DAY_MS;
}

function timeOfDayMs(wallMs: number): number {
  const day = Math.floor(wallMs / DAY_MS) * DAY_MS;
  return wallMs - day;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export interface OccurrencesInput {
  rrule: string;
  /** The rule's anchor, usually the reminder's original `at`. */
  dtstart: Date;
  offsetMinutes: number;
  /** IANA zone used for DST-correct wall-clock stepping. */
  timezone?: string;
  /** Emit at most this many occurrences; defaults to MAX_OCCURRENCES. */
  limit?: number;
}

/**
 * Every occurrence in order, starting at the anchor. COUNT and UNTIL terminate it.
 * Enumerating from the anchor is what makes COUNT exact, including for rules whose
 * earlier occurrences are already in the past.
 */
export function occurrences(input: OccurrencesInput): Date[] {
  const { rrule, dtstart, offsetMinutes, timezone } = input;
  const rule = parseRrule(rrule, offsetMinutes);
  if (!rule) return [];

  const startWallMs = timezone
    ? localWallMs(dtstart, timezone)
    : wallMsOf(dtstart, offsetMinutes);
  const clock = timeOfDayMs(startWallMs);
  const cap = Math.min(input.limit ?? MAX_OCCURRENCES, MAX_OCCURRENCES);
  const found: number[] = [];

  const toInstant = (wallMs: number): Date =>
    timezone
      ? instantFromLocalWallMs(wallMs, timezone)
      : instantFromWallMs(wallMs, offsetMinutes);

  for (let step = 0; step < MAX_OCCURRENCES && found.length < cap; step += 1) {
    const candidates = candidatesFor(rule, startWallMs, step);

    for (const candidate of candidates) {
      const wallMs = candidate + clock;
      if (wallMs < startWallMs) continue;
      if (rule.untilWallMs !== null && wallMs > rule.untilWallMs) {
        return found.map(toInstant);
      }

      found.push(wallMs);

      if (rule.count !== null && found.length >= rule.count) {
        return found.map(toInstant);
      }
    }
  }

  return found.map(toInstant);
}

/**
 * Wall-ms day-start candidates for enumeration `step`. DAILY and MONTHLY yield one
 * per step; WEEKLY yields the selected weekdays of the step-th interval week, in
 * chronological order across the week.
 */
function candidatesFor(rule: ParsedRrule, startWallMs: number, step: number): number[] {
  const startDay = Math.floor(startWallMs / DAY_MS) * DAY_MS;

  if (rule.freq === "DAILY") {
    return [startDay + step * rule.interval * DAY_MS];
  }

  if (rule.freq === "MONTHLY") {
    const startDate = new Date(startDay);
    const totalMonths =
      startDate.getUTCFullYear() * 12 + startDate.getUTCMonth() + step * rule.interval;
    const year = Math.floor(totalMonths / 12);
    const monthIndex = totalMonths % 12;
    const dayOfMonth = startDate.getUTCDate();

    // A 31st anchor skips months without a 31st instead of clamping to the 30th.
    if (dayOfMonth > daysInMonth(year, monthIndex)) return [];

    return [Date.UTC(year, monthIndex, dayOfMonth)];
  }

  const weekStart = weekStartWallMs(startDay) + step * rule.interval * 7 * DAY_MS;
  const weekdays = rule.byDay.length ? rule.byDay : [new Date(startDay).getUTCDay()];

  // Ordered by weekday position within the week, not by the BYDAY string order.
  return [...weekdays]
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    .map(code => weekStart + ((code + 6) % 7) * DAY_MS);
}

export interface NextOccurrenceInput {
  rrule: string;
  dtstart: Date;
  /** Only occurrences strictly after this instant are considered. */
  after: Date;
  offsetMinutes: number;
  /** IANA zone used for DST-correct wall-clock stepping. */
  timezone?: string;
}

/** The first occurrence strictly after `after`, or null when the rule is exhausted. */
export function nextOccurrence(input: NextOccurrenceInput): Date | null {
  for (const occurrence of occurrences(input)) {
    if (occurrence.getTime() > input.after.getTime()) return occurrence;
  }

  return null;
}

/** True when the string is a rule this engine can evaluate. */
export function supportsRrule(rrule: string): boolean {
  return parseRrule(rrule) !== null;
}

/** Short human description, used by the app to label recurring reminders. */
export function describeRrule(rrule: string): string | null {
  const rule = parseRrule(rrule);
  if (!rule) return null;

  const every = rule.interval === 1 ? "every" : `every ${rule.interval}`;
  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  if (rule.freq === "DAILY") {
    return rule.interval === 1 ? "every day" : `${every} days`;
  }

  if (rule.freq === "MONTHLY") {
    return rule.interval === 1 ? "every month" : `${every} months`;
  }

  const days = rule.byDay.length
    ? ` on ${rule.byDay.map(code => weekdayNames[code]).join(", ")}`
    : "";
  return rule.interval === 1 ? `every week${days}` : `${every} weeks${days}`;
}
