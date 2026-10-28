import { describe, expect, it } from "vitest";
import {
  computeReminderNextAt,
  describeRrule,
  nextOccurrence,
  occurrences,
  parseRrule,
} from "@robo/shared/reminders";

/** Asia/Kolkata is +05:30 year-round, which keeps these fixtures unambiguous. */
const IST = 330;

function utc(iso: string): Date {
  return new Date(iso);
}

function isoList(dates: Date[]): string[] {
  return dates.map(date => date.toISOString());
}

describe("parseRrule", () => {
  it("reads the supported shape", () => {
    expect(parseRrule("RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE")).toEqual({
      freq: "WEEKLY",
      interval: 2,
      byDay: [1, 3],
      count: null,
      untilWallMs: null,
    });
  });

  it("rejects frequencies and parts it cannot evaluate", () => {
    expect(parseRrule("FREQ=HOURLY")).toBeNull();
    expect(parseRrule("FREQ=DAILY;BYMONTHDAY=15")).toBeNull();
    expect(parseRrule("FREQ=DAILY;INTERVAL=0")).toBeNull();
    expect(parseRrule("")).toBeNull();
    expect(parseRrule("FREQ=WEEKLY;BYDAY=2MO")).toBeNull();
    expect(parseRrule("FREQ=WEEKLY;BYDAY=MO,XX")).toBeNull();
    expect(parseRrule("FREQ=MONTHLY;BYDAY=MO")).toBeNull();
  });
});

describe("occurrences", () => {
  it("steps one day at a time from the anchor, keeping the wall-clock time", () => {
    const result = occurrences({
      rrule: "FREQ=DAILY",
      dtstart: utc("2026-10-22T13:30:00Z"),
      offsetMinutes: IST,
      limit: 4,
    });

    expect(isoList(result)).toEqual([
      "2026-10-22T13:30:00.000Z",
      "2026-10-23T13:30:00.000Z",
      "2026-10-24T13:30:00.000Z",
      "2026-10-25T13:30:00.000Z",
    ]);
  });

  it("honours INTERVAL for daily rules", () => {
    const result = occurrences({
      rrule: "FREQ=DAILY;INTERVAL=2",
      dtstart: utc("2026-10-22T13:30:00Z"),
      offsetMinutes: IST,
      limit: 3,
    });

    expect(isoList(result)).toEqual([
      "2026-10-22T13:30:00.000Z",
      "2026-10-24T13:30:00.000Z",
      "2026-10-26T13:30:00.000Z",
    ]);
  });

  it("drops weekly occurrences before the anchor and orders BYDAY within the week", () => {
    // 2026-10-22 is a Thursday, so Monday and Wednesday of that week are in the past.
    const result = occurrences({
      rrule: "FREQ=WEEKLY;BYDAY=MO,WE,FR",
      dtstart: utc("2026-10-22T13:30:00Z"),
      offsetMinutes: IST,
      limit: 4,
    });

    expect(isoList(result)).toEqual([
      "2026-10-23T13:30:00.000Z", // Fri
      "2026-10-26T13:30:00.000Z", // Mon
      "2026-10-28T13:30:00.000Z", // Wed
      "2026-10-30T13:30:00.000Z", // Fri
    ]);
  });

  it("repeats the anchor weekday when WEEKLY has no BYDAY", () => {
    const result = occurrences({
      rrule: "FREQ=WEEKLY",
      dtstart: utc("2026-10-22T13:30:00Z"),
      offsetMinutes: IST,
      limit: 3,
    });

    expect(isoList(result)).toEqual([
      "2026-10-22T13:30:00.000Z",
      "2026-10-29T13:30:00.000Z",
      "2026-11-05T13:30:00.000Z",
    ]);
  });

  it("skips months that do not contain the anchor day", () => {
    const result = occurrences({
      rrule: "FREQ=MONTHLY",
      dtstart: utc("2026-10-31T13:30:00Z"),
      offsetMinutes: IST,
      limit: 3,
    });

    // November has 30 days, so it is skipped rather than clamped to the 30th.
    expect(isoList(result)).toEqual([
      "2026-10-31T13:30:00.000Z",
      "2026-12-31T13:30:00.000Z",
      "2027-01-31T13:30:00.000Z",
    ]);
  });

  it("stops at COUNT", () => {
    expect(
      occurrences({
        rrule: "FREQ=DAILY;COUNT=3",
        dtstart: utc("2026-10-22T13:30:00Z"),
        offsetMinutes: IST,
        limit: 40,
      })
    ).toHaveLength(3);
  });

  it("stops past UNTIL, read as a local wall time", () => {
    const result = occurrences({
      rrule: "FREQ=DAILY;UNTIL=20261025T235959",
      dtstart: utc("2026-10-22T13:30:00Z"),
      offsetMinutes: IST,
      limit: 40,
    });

    expect(result).toHaveLength(4);
    expect(result[3].toISOString()).toBe("2026-10-25T13:30:00.000Z");
  });

  it("keeps the local wall time across spring-forward when a timezone is given", () => {
    const result = occurrences({
      rrule: "FREQ=DAILY",
      dtstart: utc("2026-03-07T14:00:00Z"),
      offsetMinutes: -300,
      timezone: "America/New_York",
      limit: 3,
    });

    // 09:00 EST on the 7th, then 09:00 EDT on the 8th and 9th.
    expect(isoList(result)).toEqual([
      "2026-03-07T14:00:00.000Z",
      "2026-03-08T13:00:00.000Z",
      "2026-03-09T13:00:00.000Z",
    ]);
  });

  it("keeps the local wall time across fall-back when a timezone is given", () => {
    const result = occurrences({
      rrule: "FREQ=DAILY",
      dtstart: utc("2026-10-31T13:00:00Z"),
      offsetMinutes: -240,
      timezone: "America/New_York",
      limit: 3,
    });

    // 09:00 EDT on the 31st, then 09:00 EST on Nov 1 and 2.
    expect(isoList(result)).toEqual([
      "2026-10-31T13:00:00.000Z",
      "2026-11-01T14:00:00.000Z",
      "2026-11-02T14:00:00.000Z",
    ]);
  });

  it("returns nothing for an unusable rule", () => {
    expect(
      occurrences({
        rrule: "FREQ=YEARLY",
        dtstart: utc("2026-10-22T13:30:00Z"),
        offsetMinutes: IST,
      })
    ).toEqual([]);
  });
});

describe("nextOccurrence", () => {
  it("returns the first slot strictly after the given instant", () => {
    const next = nextOccurrence({
      rrule: "FREQ=DAILY",
      dtstart: utc("2026-10-20T13:30:00Z"),
      after: utc("2026-10-22T13:30:00Z"),
      offsetMinutes: IST,
    });

    // The 22nd slot is exactly `after`, so it must not be re-offered.
    expect(next?.toISOString()).toBe("2026-10-23T13:30:00.000Z");
  });

  it("returns null once a bounded rule is exhausted", () => {
    expect(
      nextOccurrence({
        rrule: "FREQ=DAILY;COUNT=2",
        dtstart: utc("2026-10-20T13:30:00Z"),
        after: utc("2026-10-21T13:30:00Z"),
        offsetMinutes: IST,
      })
    ).toBeNull();
  });
});

describe("computeReminderNextAt", () => {
  it("keeps a one-off reminder whose date is still ahead", () => {
    const at = utc("2026-10-25T13:30:00Z");

    expect(computeReminderNextAt({ at, rrule: null }, utc("2026-10-22T09:00:00Z"))).toEqual(at);
  });

  it("never re-fires a one-off reminder that has passed", () => {
    expect(
      computeReminderNextAt(
        { at: utc("2026-10-21T13:30:00Z"), rrule: null },
        utc("2026-10-22T09:00:00Z")
      )
    ).toBeNull();
  });

  it("advances a recurring reminder whose anchor is long past", () => {
    expect(
      computeReminderNextAt(
        { at: utc("2026-01-01T13:30:00Z"), rrule: "FREQ=DAILY" },
        utc("2026-10-22T13:30:00Z"),
        "Asia/Kolkata"
      )?.toISOString()
    ).toBe("2026-10-23T13:30:00.000Z");
  });

  it("falls back to the one-off date when the rule is unsupported", () => {
    const at = utc("2026-10-24T13:30:00Z");

    expect(
      computeReminderNextAt(
        { at, rrule: "FREQ=HOURLY" },
        utc("2026-10-22T09:00:00Z"),
        "Asia/Kolkata"
      )
    ).toEqual(at);
  });

  it("advances across a DST transition in the user's zone", () => {
    expect(
      computeReminderNextAt(
        { at: utc("2026-03-07T14:00:00Z"), rrule: "FREQ=DAILY" },
        utc("2026-03-07T15:00:00Z"),
        "America/New_York"
      )?.toISOString()
    ).toBe("2026-03-08T13:00:00.000Z");
  });

  it("tolerates an unknown timezone by treating the rule as UTC", () => {
    expect(
      computeReminderNextAt(
        { at: utc("2026-10-22T13:30:00Z"), rrule: "FREQ=DAILY" },
        utc("2026-10-22T09:00:00Z"),
        "Not/AZone"
      )?.toISOString()
    ).toBe("2026-10-22T13:30:00.000Z");
  });
});

describe("describeRrule", () => {
  it("labels the supported rules", () => {
    expect(describeRrule("FREQ=DAILY")).toBe("every day");
    expect(describeRrule("FREQ=DAILY;INTERVAL=3")).toBe("every 3 days");
    expect(describeRrule("FREQ=WEEKLY;BYDAY=MO,FR")).toBe("every week on Mon, Fri");
    expect(describeRrule("FREQ=MONTHLY;INTERVAL=2")).toBe("every 2 months");
    expect(describeRrule("FREQ=HOURLY")).toBeNull();
  });
});
