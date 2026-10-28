import { describe, expect, it, vi } from "vitest";
import {
  isWithinQuietHours,
  nudgeCandidates,
  normalizeNudgeSettings,
  type NudgeSettings,
} from "@robo/shared/nudges";
import { createNudgeNotifier } from "../src/modules/nudges/notifier";
import { NudgeScheduler } from "../src/modules/nudges/scheduler";

const NOW = new Date("2026-10-23T16:00:00.000Z");

const settings: NudgeSettings = {
  enabled: true,
  maxPerDay: 4,
  types: { reminders: true, study: true, exams: true, tasks: true },
};

function input(overrides: Record<string, unknown> = {}) {
  return {
    now: NOW,
    timezone: "UTC",
    settings,
    quietHours: null,
    sentToday: 0,
    sentTypes: [],
    tasks: [],
    exams: [],
    reminders: [],
    studiedToday: false,
    ...overrides,
  };
}

describe("isWithinQuietHours", () => {
  it("handles a same-day window", () => {
    const quiet = { enabled: true, start: "13:00", end: "15:00" };
    expect(isWithinQuietHours(quiet, 13 * 60)).toBe(true);
    expect(isWithinQuietHours(quiet, 14 * 60 + 59)).toBe(true);
    expect(isWithinQuietHours(quiet, 15 * 60)).toBe(false);
  });

  it("handles a window that wraps midnight", () => {
    const quiet = { enabled: true, start: "22:00", end: "07:00" };
    expect(isWithinQuietHours(quiet, 23 * 60)).toBe(true);
    expect(isWithinQuietHours(quiet, 6 * 60)).toBe(true);
    expect(isWithinQuietHours(quiet, 12 * 60)).toBe(false);
  });

  it("ignores disabled quiet hours", () => {
    expect(
      isWithinQuietHours({ enabled: false, start: "00:00", end: "23:59" }, 720)
    ).toBe(false);
  });
});

describe("nudgeCandidates", () => {
  it("returns nothing when nudges are disabled or capped", () => {
    expect(
      nudgeCandidates(input({ settings: { ...settings, enabled: false } }))
    ).toEqual([]);
    expect(nudgeCandidates(input({ sentToday: 4 }))).toEqual([]);
    expect(nudgeCandidates(input({ settings: { ...settings, maxPerDay: 0 } }))).toEqual([]);
  });

  it("stays silent during quiet hours and outside the active window", () => {
    expect(
      nudgeCandidates(
        input({ quietHours: { enabled: true, start: "15:00", end: "17:00" } })
      )
    ).toEqual([]);
    expect(
      nudgeCandidates(input({ now: new Date("2026-10-23T07:59:00.000Z") }))
    ).toEqual([]);
  });

  it("prioritises tasks, then exams, then study and reminders", () => {
    const candidates = nudgeCandidates(
      input({
        tasks: [
          { title: "Overdue", dueAt: new Date("2026-10-22T10:00:00.000Z") },
          { title: "Today", dueAt: new Date("2026-10-23T20:00:00.000Z") },
        ],
        exams: [{ title: "Physics", date: new Date("2026-10-25T09:00:00.000Z") }],
        reminders: [{ text: "Stretch", nextAt: new Date("2026-10-23T18:00:00.000Z") }],
      })
    );

    expect(candidates.map(candidate => candidate.type)).toEqual([
      "TASK",
      "EXAM",
      "STUDY",
      "REMINDER",
    ]);
    expect(candidates[0]?.body).toContain("1 overdue and 1 due today");
    expect(candidates[1]?.body).toContain("in 2 days");
  });

  it("caps the number of nudges sent in one tick", () => {
    const candidates = nudgeCandidates(
      input({
        settings: { ...settings, maxPerDay: 2 },
        tasks: [{ title: "Today", dueAt: new Date("2026-10-23T20:00:00.000Z") }],
        exams: [{ title: "Physics", date: new Date("2026-10-25T09:00:00.000Z") }],
      })
    );

    expect(candidates).toHaveLength(2);
    expect(candidates.map(candidate => candidate.type)).toEqual(["TASK", "EXAM"]);
  });

  it("does not repeat a type already sent today or a disabled type", () => {
    const candidates = nudgeCandidates(
      input({
        sentTypes: ["TASK", "EXAM"],
        studiedToday: true,
        settings: {
          ...settings,
          types: { reminders: false, study: true, exams: true, tasks: true },
        },
        tasks: [{ title: "Today", dueAt: new Date("2026-10-23T20:00:00.000Z") }],
        exams: [{ title: "Physics", date: new Date("2026-10-25T09:00:00.000Z") }],
        reminders: [{ text: "Stretch", nextAt: new Date("2026-10-23T18:00:00.000Z") }],
      })
    );

    expect(candidates).toEqual([]);
  });

  it("only nudges about study from mid-afternoon", () => {
    expect(
      nudgeCandidates(input({ now: new Date("2026-10-23T12:00:00.000Z") })).map(
        candidate => candidate.type
      )
    ).not.toContain("STUDY");
    expect(nudgeCandidates(input()).map(candidate => candidate.type)).toContain("STUDY");
  });
});

describe("normalizeNudgeSettings", () => {
  it("rejects malformed JSON and clamps maxPerDay", () => {
    expect(normalizeNudgeSettings(null)).toBeNull();
    expect(normalizeNudgeSettings({ enabled: true })).toBeNull();
    expect(
      normalizeNudgeSettings({
        enabled: true,
        maxPerDay: 99,
        types: { reminders: true, study: true, exams: false, tasks: true },
      })?.maxPerDay
    ).toBe(20);
  });
});

describe("createNudgeNotifier", () => {
  it("reports device and push channels", async () => {
    const push = vi.fn(async () => ({ sent: 1, failed: 0 }));
    const notify = createNudgeNotifier({ notifyUser: () => 2, push });

    await expect(
      notify("user-1", { type: "TASK", title: "Tasks", body: "One due today." })
    ).resolves.toEqual(["device", "push"]);
    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        title: "Tasks",
        data: { kind: "nudge", nudgeType: "TASK" },
      })
    );
  });

  it("reports push only when no device is connected", async () => {
    const notify = createNudgeNotifier({
      notifyUser: () => 0,
      push: async () => ({ sent: 1, failed: 0 }),
    });

    await expect(
      notify("user-1", { type: "STUDY", title: "Study", body: "Start a session." })
    ).resolves.toEqual(["push"]);
  });
});

describe("NudgeScheduler", () => {
  const user = {
    id: "user-1",
    timezone: "UTC",
    quietHours: null,
    nudgeSettings: settings,
  };

  it("claims and delivers at most the allowed candidates", async () => {
    const deliver = vi.fn(async () => ["push"]);
    const claim = vi.fn(async () => true);
    const scheduler = new NudgeScheduler({
      listUsers: async () => [user],
      loadContext: async () => ({
        tasks: [{ title: "Today", dueAt: new Date("2026-10-23T20:00:00.000Z") }],
        exams: [],
        reminders: [],
        studiedToday: true,
        sentToday: 0,
        sentTypes: [],
      }),
      claim,
      deliver,
    });

    await expect(scheduler.tick(NOW)).resolves.toEqual({ sent: 1, skipped: 0 });
    expect(claim).toHaveBeenCalledTimes(1);
    expect(deliver).toHaveBeenCalledWith("user-1", expect.objectContaining({ type: "TASK" }));
  });

  it("skips users whose claim loses a race", async () => {
    const deliver = vi.fn(async () => ["push"]);
    const scheduler = new NudgeScheduler({
      listUsers: async () => [user],
      loadContext: async () => ({
        tasks: [{ title: "Today", dueAt: new Date("2026-10-23T20:00:00.000Z") }],
        exams: [],
        reminders: [],
        studiedToday: true,
        sentToday: 0,
        sentTypes: [],
      }),
      claim: async () => false,
      deliver,
    });

    await expect(scheduler.tick(NOW)).resolves.toEqual({ sent: 0, skipped: 1 });
    expect(deliver).not.toHaveBeenCalled();
  });

  it("skips users who disabled nudges", async () => {
    const scheduler = new NudgeScheduler({
      listUsers: async () => [{ ...user, nudgeSettings: null }],
      deliver: async () => [],
    });

    await expect(scheduler.tick(NOW)).resolves.toEqual({ sent: 0, skipped: 1 });
  });
});
