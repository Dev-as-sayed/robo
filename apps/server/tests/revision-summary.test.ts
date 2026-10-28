import { describe, expect, it } from "vitest";
import { buildRevisionNarrative } from "@robo/shared/exams";

const base = {
  examSubject: "Physics",
  daysLeft: 5,
  preparedness: 40,
  missingTasks: ["Optics", "Waves"],
  remainingTopics: ["Optics", "Waves"],
  weakTopics: [] as string[],
  quizAverage: null as number | null,
  nextTask: null as { title: string; dueAt: Date | null } | null,
};

describe("buildRevisionNarrative", () => {
  it("summarizes remaining work and the next task", () => {
    const text = buildRevisionNarrative({
      ...base,
      nextTask: { title: "Optics", dueAt: new Date("2026-10-24T18:00:00Z") },
    });

    expect(text).toContain("2 tasks left for Physics (40% prepared)");
    expect(text).toContain("Next: Optics");
    expect(text).toContain("Still uncovered: Optics, Waves");
  });

  it("names weak topics and the recent quiz average", () => {
    const text = buildRevisionNarrative({
      ...base,
      weakTopics: ["Lenses", "Refraction"],
      quizAverage: 72,
    });

    expect(text).toContain("Focus on Lenses, Refraction");
    expect(text).toContain("Recent quiz average: 72%");
  });

  it("celebrates a complete plan", () => {
    const text = buildRevisionNarrative({
      ...base,
      preparedness: 100,
      missingTasks: [],
      remainingTopics: [],
    });

    expect(text).toContain("All planned tasks for Physics are complete");
  });

  it("urges action when the exam is close", () => {
    const text = buildRevisionNarrative({ ...base, daysLeft: 2 });
    expect(text).toContain("exam is close");
  });
});
