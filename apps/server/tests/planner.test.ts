import { describe, expect, it } from "vitest";
import { buildDailyPlan, rankTasks } from "@robo/shared/planner";

const NOW = new Date("2026-10-23T10:00:00.000Z");

function task(overrides: Partial<Parameters<typeof rankTasks>[0][number]> = {}) {
  return {
    id: "task-1",
    title: "Read chapter 4",
    dueAt: null,
    priority: "medium",
    ...overrides,
  };
}

describe("rankTasks", () => {
  it("puts overdue work before tasks due today", () => {
    const ranked = rankTasks(
      [
        task({ id: "today", title: "Today", dueAt: new Date("2026-10-23T20:00:00.000Z") }),
        task({ id: "late", title: "Late", dueAt: new Date("2026-10-21T20:00:00.000Z") }),
      ],
      NOW,
      "UTC"
    );

    expect(ranked.map(row => row.id)).toEqual(["late", "today"]);
    expect(ranked[0]?.reason).toBe("Overdue by 2 days");
  });

  it("breaks due-date ties with priority", () => {
    const ranked = rankTasks(
      [
        task({ id: "low", title: "Low", dueAt: NOW, priority: "low" }),
        task({ id: "urgent", title: "Urgent", dueAt: NOW, priority: "urgent" }),
        task({ id: "high", title: "High", dueAt: NOW, priority: "high" }),
      ],
      NOW,
      "UTC"
    );

    expect(ranked.map(row => row.id)).toEqual(["urgent", "high", "low"]);
  });

  it("limits the plan to six tasks", () => {
    const ranked = rankTasks(
      Array.from({ length: 10 }, (_, index) =>
        task({ id: `task-${index}`, title: `Task ${index}`, dueAt: NOW })
      ),
      NOW,
      "UTC"
    );

    expect(ranked).toHaveLength(6);
  });
});

describe("buildDailyPlan", () => {
  it("combines the next class, the top task and the nearest exam", () => {
    const plan = buildDailyPlan({
      now: NOW,
      timezone: "UTC",
      tasks: [task({ title: "Lab report", dueAt: new Date("2026-10-23T18:00:00.000Z") })],
      exams: [
        { id: "exam-1", subject: "Physics", date: new Date("2026-10-26T09:00:00.000Z") },
        { id: "exam-2", subject: "Math", date: new Date("2026-11-10T09:00:00.000Z") },
      ],
      reminders: [
        { id: "rem-1", text: "Stretch", nextAt: new Date("2026-10-23T15:00:00.000Z") },
        { id: "rem-2", text: "Tomorrow", nextAt: new Date("2026-10-24T09:00:00.000Z") },
      ],
      classes: [
        {
          title: "Calculus",
          startAt: new Date("2026-10-23T12:00:00.000Z"),
          endAt: new Date("2026-10-23T13:00:00.000Z"),
          room: "B12",
        },
      ],
      activeSession: null,
    });

    expect(plan.tasks).toHaveLength(1);
    expect(plan.exams.map(exam => exam.subject)).toEqual(["Physics", "Math"]);
    expect(plan.reminders.map(reminder => reminder.id)).toEqual(["rem-1"]);
    expect(plan.nextClass?.title).toBe("Calculus");
    expect(plan.summary).toContain("start with \"Lab report\" (due today)");
    expect(plan.summary).toContain("next class is Calculus");
    expect(plan.summary).toContain("Physics exam is in 3 days");
  });

  it("notes an already-running session and falls back when nothing is due", () => {
    const plan = buildDailyPlan({
      now: NOW,
      timezone: "UTC",
      tasks: [],
      exams: [],
      reminders: [],
      classes: [],
      activeSession: { subject: "Biology", startedAt: new Date("2026-10-23T09:30:00.000Z") },
    });

    expect(plan.summary).toContain("Biology study session is already running");
    expect(plan.nextClass).toBeNull();
  });
});
