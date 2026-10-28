import { describe, expect, it } from "vitest";
import { buildAnalyticsNarrative, calculateStreak } from "@robo/shared/analytics";

const empty = {
  totalStudyHours: 0,
  completedTasks: 0,
  completedQuizzes: 0,
  activeReminders: 0,
  upcomingExams: 0,
  streakDays: 0,
};

describe("buildAnalyticsNarrative", () => {
  it("says when nothing was recorded", () => {
    expect(buildAnalyticsNarrative(empty, "week")).toBe(
      "No study activity recorded this week."
    );
  });

  it("summarises study, tasks, quizzes, streak and exams", () => {
    expect(
      buildAnalyticsNarrative(
        {
          totalStudyHours: 2.5,
          completedTasks: 3,
          completedQuizzes: 1,
          activeReminders: 4,
          upcomingExams: 2,
          streakDays: 5,
        },
        "week"
      )
    ).toBe(
      "2.5 hours studied, 3 tasks completed, 1 quiz done, a 5-day streak this week. 2 exams ahead."
    );
  });
});

describe("calculateStreak", () => {
  it("keeps a streak alive through yesterday before today's first activity", () => {
    expect(calculateStreak(["2026-10-22", "2026-10-21"], "2026-10-23")).toBe(2);
  });

  it("counts today when it is active", () => {
    expect(
      calculateStreak(["2026-10-23", "2026-10-22", "2026-10-20"], "2026-10-23")
    ).toBe(2);
  });
});
