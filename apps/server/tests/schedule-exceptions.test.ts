import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  scheduleEntry: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
  scheduleException: {
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  user: { findUnique: vi.fn() },
}));

vi.mock("@robo/shared/lib/prisma", () => ({ prisma: db }));

const { getSchedule, removeException } = await import("@robo/shared/schedule");

const firstClass = {
  id: "class-1",
  userId: "user-1",
  title: "Algorithms",
  description: null,
  startAt: new Date("2026-10-23T10:00:00.000Z"),
  endAt: null,
  allDay: false,
  subject: "CS",
  room: "B12",
  teacher: null,
  alertLeadMinutes: null,
  alertAt: null,
  alertedAt: null,
  createdAt: new Date("2026-10-20T10:00:00.000Z"),
  updatedAt: new Date("2026-10-20T10:00:00.000Z"),
  exceptions: [
    {
      id: "exception-1",
      date: new Date("2026-10-23T00:00:00.000Z"),
      reason: null,
    },
  ],
};

const secondClass = {
  ...firstClass,
  id: "class-2",
  title: "Physics",
  startAt: new Date("2026-10-24T10:00:00.000Z"),
  exceptions: [],
};

describe("getSchedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.user.findUnique.mockResolvedValue({ timezone: "UTC" });
  });

  it("hides entries skipped on their class day", async () => {
    db.scheduleEntry.findMany.mockResolvedValue([firstClass, secondClass]);

    const schedule = await getSchedule("user-1");

    expect(schedule.map(entry => entry.id)).toEqual(["class-2"]);
  });

  it("returns skipped entries for the undo view", async () => {
    db.scheduleEntry.findMany.mockResolvedValue([firstClass, secondClass]);

    const schedule = await getSchedule("user-1", { includeSkipped: true });

    expect(schedule.map(entry => entry.id)).toEqual(["class-1", "class-2"]);
    expect(schedule[0]).toEqual(
      expect.objectContaining({
        isSkipped: true,
        skippedExceptionId: "exception-1",
      })
    );
  });

  it("matches date-only exceptions in west timezones", async () => {
    db.user.findUnique.mockResolvedValue({ timezone: "America/New_York" });
    db.scheduleEntry.findMany.mockResolvedValue([
      {
        ...firstClass,
        startAt: new Date("2026-10-23T23:30:00.000Z"),
      },
    ]);

    const schedule = await getSchedule("user-1", { includeSkipped: true });

    expect(schedule[0]).toEqual(
      expect.objectContaining({
        isSkipped: true,
        skippedExceptionId: "exception-1",
      })
    );
  });
});

describe("removeException", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes an exception owned by the schedule and user", async () => {
    db.scheduleException.deleteMany.mockResolvedValue({ count: 1 });

    await expect(
      removeException("user-1", "class-1", "exception-1")
    ).resolves.toEqual({ count: 1 });
    expect(db.scheduleException.deleteMany).toHaveBeenCalledWith({
      where: {
        id: "exception-1",
        scheduleId: "class-1",
        userId: "user-1",
      },
    });
  });

  it("rejects an unknown exception", async () => {
    db.scheduleException.deleteMany.mockResolvedValue({ count: 0 });

    await expect(
      removeException("user-1", "class-1", "missing")
    ).rejects.toThrow("SCHEDULE_EXCEPTION_NOT_FOUND");
  });
});
