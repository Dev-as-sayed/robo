const MINUTE_MS = 60_000;

/** Minutes ahead of UTC, e.g. 330 for Asia/Kolkata. Falls back to UTC if unknown. */
export function tzOffsetMinutes(timezone: string | null | undefined, at: Date): number {
  if (!timezone) return 0;

  try {
    const utc = new Date(at.toLocaleString("en-US", { timeZone: "UTC" }));
    const local = new Date(at.toLocaleString("en-US", { timeZone: timezone }));
    return Math.round((local.getTime() - utc.getTime()) / MINUTE_MS);
  } catch {
    return 0;
  }
}

/**
 * Calendar day an instant belongs to in a zone with the given fixed offset, as
 * `YYYY-MM-DD`. Two instants are on the same local day when their keys match.
 */
export function dayKey(instant: Date, offsetMinutes = 0): string {
  const shifted = new Date(instant.getTime() + offsetMinutes * MINUTE_MS);

  return [
    String(shifted.getUTCFullYear()),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0"),
  ].join("-");
}
