import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  studyPlan: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  user: { findUnique: vi.fn() },
  todo: { create: vi.fn(), update: vi.fn() },
  dailyTask: { update: vi.fn() },
  reminder: { create: vi.fn() },
  exam: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@robo/shared/lib/prisma", () => ({ prisma: db }));

const { approvePlan, getPlan, getReadiness, recalculatePlan } =
  await import("@robo/shared/exams");

const NOW = new Date("2026-10-23T10:00:00.000Z");

function plan(overrides: Record<string, unknown> = {}) {
  return {
    id: "plan-1",
    examId: "exam-1",
    userId: "user-1",
    totalDays: 2,
    approvedAt: null,
    reminderId: null,
    exam: {
      id: "exam-1",
      userId: "user-1",
      subject: "Physics",
      date: new Date("2026-10-25T09:00:00.000Z"),
    },
    dailyTasks: [
      { id: "task-1", day: 1, title: "Study topic - Day 1", todoId: null },
      { id: "task-2", day: 2, title: "Study topic - Day 2", todoId: null },
    ],
    ...overrides,
  };
}

describe("getPlan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the persisted plan and its daily tasks", async () => {
    const persisted = plan({
      approvedAt: NOW,
      reminderId: "reminder-1",
      createdAt: NOW,
      updatedAt: NOW,
      dailyTasks: [
        {
          id: "task-1",
          planId: "plan-1",
          day: 1,
          title: "Study topic - Day 1",
          completed: false,
          todoId: "todo-1",
        },
      ],
    });
    db.studyPlan.findFirst.mockResolvedValue(persisted);

    const result = await getPlan("user-1", "exam-1");

    expect(result.plan).toEqual(
      expect.objectContaining({
        id: "plan-1",
        examId: "exam-1",
        approvedAt: NOW,
        reminderId: "reminder-1",
      })
    );
    expect(result.dailyTasks).toEqual([
      {
        id: "task-1",
        day: 1,
        title: "Study topic - Day 1",
        completed: false,
      },
    ]);
  });

  it("rejects an exam without a plan", async () => {
    db.studyPlan.findFirst.mockResolvedValue(null);

    await expect(getPlan("user-1", "exam-1")).rejects.toThrow("PLAN_NOT_FOUND");
  });
});

describe("approvePlan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.user.findUnique.mockResolvedValue({ timezone: "UTC" });
    db.todo.create
      .mockResolvedValueOnce({ id: "todo-1" })
      .mockResolvedValueOnce({ id: "todo-2" });
    db.reminder.create.mockResolvedValue({ id: "reminder-1" });
    db.$transaction.mockImplementation(async (callback: (tx: typeof db) => unknown) =>
      callback(db)
    );
  });

  it("creates one task per plan day and a daily study reminder", async () => {
    db.studyPlan.findFirst.mockResolvedValue(plan());

    const result = await approvePlan("user-1", "plan-1", NOW);

    expect(result.todosCreated).toBe(2);
    expect(result.reminderId).toBe("reminder-1");
    expect(db.todo.create).toHaveBeenCalledTimes(2);
    expect(db.todo.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          subject: "Physics",
          status: "pending",
          dueAt: new Date("2026-10-23T18:00:00.000Z"),
        }),
      })
    );
    expect(db.todo.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          dueAt: new Date("2026-10-24T18:00:00.000Z"),
        }),
      })
    );
    expect(db.dailyTask.update).toHaveBeenCalledWith({
      where: { id: "task-1" },
      data: { todoId: "todo-1" },
    });
    expect(db.reminder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          text: "Study for Physics",
          rrule: "FREQ=DAILY;UNTIL=20261025T175900",
          channels: ["device", "push"],
          linkedEntity: "exam",
        }),
      })
    );
    expect(db.studyPlan.update).toHaveBeenCalledWith({
      where: { id: "plan-1" },
      data: { approvedAt: NOW, reminderId: "reminder-1" },
    });
    expect(db.exam.update).toHaveBeenCalledWith({
      where: { id: "exam-1", userId: "user-1" },
      data: { status: "active" },
    });
  });

  it("is idempotent once a plan is approved", async () => {
    db.studyPlan.findFirst.mockResolvedValue(
      plan({ approvedAt: NOW, reminderId: "reminder-1" })
    );

    const result = await approvePlan("user-1", "plan-1", NOW);

    expect(result.todosCreated).toBe(0);
    expect(result.reminderId).toBe("reminder-1");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("cannot approve another user's plan", async () => {
    db.studyPlan.findFirst.mockResolvedValue(null);

    await expect(approvePlan("user-2", "plan-1", NOW)).rejects.toThrow(
      "PLAN_NOT_FOUND"
    );
    expect(db.studyPlan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "plan-1", userId: "user-2" } })
    );
  });
});

describe("getReadiness", () => {
  it("counts linked completed tasks and leaves uncovered topics", async () => {
    db.exam.findFirst.mockResolvedValue({
      id: "exam-1",
      userId: "user-1",
      subject: "Physics",
      topics: ["Algebra", "Optics"],
      studyPlan: {
        dailyTasks: [
          {
            title: "Algebra revision",
            completed: false,
            todo: { status: "completed" },
          },
          {
            title: "Optics revision",
            completed: false,
            todo: { status: "pending" },
          },
        ],
      },
    });

    await expect(getReadiness("user-1", "exam-1")).resolves.toEqual({
      preparedness: 50,
      remainingTopics: ["Optics"],
      missingTasks: ["Optics revision"],
    });
  });
});

describe("recalculatePlan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.user.findUnique.mockResolvedValue({ timezone: "UTC" });
    db.$transaction.mockImplementation(async (callback: (tx: typeof db) => unknown) =>
      callback(db)
    );
  });

  it("spreads remaining tasks across the days left before the exam", async () => {
    db.studyPlan.findFirst.mockResolvedValue(
      plan({
        approvedAt: NOW,
        dailyTasks: [
          {
            id: "task-1",
            day: 1,
            title: "Algebra",
            completed: false,
            todo: { id: "todo-1", status: "pending" },
          },
          {
            id: "task-2",
            day: 2,
            title: "Optics",
            completed: false,
            todo: { id: "todo-2", status: "pending" },
          },
        ],
      })
    );

    await expect(recalculatePlan("user-1", "exam-1", NOW)).resolves.toEqual({
      rescheduled: 2,
      preparedness: 0,
      daysLeft: 3,
    });
    expect(db.todo.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: "todo-1", userId: "user-1" },
        data: expect.objectContaining({ dueAt: new Date("2026-10-23T18:00:00.000Z") }),
      })
    );
    expect(db.todo.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({ dueAt: new Date("2026-10-24T18:00:00.000Z") }),
      })
    );
  });

  it("leaves completed tasks in place", async () => {
    db.studyPlan.findFirst.mockResolvedValue(
      plan({
        approvedAt: NOW,
        dailyTasks: [
          {
            id: "task-1",
            day: 1,
            title: "Algebra",
            completed: false,
            todo: { id: "todo-1", status: "completed" },
          },
          {
            id: "task-2",
            day: 2,
            title: "Optics",
            completed: false,
            todo: { id: "todo-2", status: "pending" },
          },
        ],
      })
    );

    await expect(recalculatePlan("user-1", "exam-1", NOW)).resolves.toEqual({
      rescheduled: 1,
      preparedness: 50,
      daysLeft: 3,
    });
    expect(db.todo.update).toHaveBeenCalledTimes(1);
  });

  it("refuses a draft plan", async () => {
    db.studyPlan.findFirst.mockResolvedValue(plan({ approvedAt: null }));

    await expect(recalculatePlan("user-1", "exam-1", NOW)).rejects.toThrow(
      "PLAN_NOT_APPROVED"
    );
  });
});
