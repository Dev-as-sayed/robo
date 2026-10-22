const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function startOfDay(value: string | Date): Date {
  const date = toDate(value);
  date.setHours(0, 0, 0, 0);

  return date;
}

export function addDays(value: string | Date, days: number): Date {
  const date = startOfDay(value);
  date.setDate(date.getDate() + days);

  return date;
}

export function isoDate(value: string | Date): string {
  const date = toDate(value);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

export function isoDateTime(value: string | Date): string {
  const date = toDate(value);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${isoDate(date)}T${hours}:${minutes}:00`;
}

/**
 * Turns "2026-10-30" plus optional "18:00" into an ISO string. Returns null when the
 * inputs cannot be parsed so screens can show a validation message instead of Invalid Date.
 */
export function parseDateTime(datePart: string, timePart?: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart.trim())) {
    return null;
  }

  const safeTime = timePart && /^\d{1,2}:\d{2}$/.test(timePart.trim()) ? timePart.trim() : "00:00";
  const [hours, minutes] = safeTime.split(":").map(Number);

  if (hours > 23 || minutes > 59) {
    return null;
  }

  const candidate = new Date(`${datePart.trim()}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`);
  if (Number.isNaN(candidate.getTime())) {
    return null;
  }

  return candidate.toISOString();
}

export function formatDay(value: string | Date): string {
  return toDate(value).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatTime(value: string | Date): string {
  return toDate(value).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDayTime(value: string | Date): string {
  return `${formatDay(value)} · ${formatTime(value)}`;
}

export function formatRange(startAt: string, endAt: string | null): string {
  if (!endAt) return formatTime(startAt);

  return `${formatTime(startAt)} – ${formatTime(endAt)}`;
}

export function daysUntil(value: string | Date): number {
  return Math.round((startOfDay(value).getTime() - startOfDay(new Date()).getTime()) / DAY_MS);
}

export function countdownLabel(milliseconds: number): string {
  const totalMinutes = Math.max(0, Math.round(milliseconds / MINUTE_MS));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;

  return `${minutes}m`;
}

export function relativeTime(iso: string | null): string {
  if (!iso) return "never";

  const delta = Date.now() - toDate(iso).getTime();
  const future = delta < 0;
  const absolute = Math.abs(delta);

  if (absolute < 45 * MINUTE_MS) {
    return future ? "in a moment" : "just now";
  }

  let value: number;
  let unit: string;

  if (absolute < DAY_MS) {
    value = Math.round(absolute / HOUR_MS);
    unit = "h";
  } else if (absolute < 30 * DAY_MS) {
    value = Math.round(absolute / DAY_MS);
    unit = "d";
  } else {
    return formatDay(iso);
  }

  return future ? `in ${value}${unit}` : `${value}${unit} ago`;
}

export function clock(msRemaining: number): string {
  const seconds = Math.max(0, Math.round(msRemaining / 1000));
  const minutes = Math.floor(seconds / 60);

  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
