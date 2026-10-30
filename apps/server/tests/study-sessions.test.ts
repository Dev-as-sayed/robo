import { describe, expect, it } from "vitest";
import {
  sessionStudyMinutes,
  toStudySessionResult,
  type StudySession,
} from "@robo/shared/sessions";

const startedAt = new Date("2026-10-23T10:00:00.000Z");

const activeSession: StudySession = {
  id: "session-1",
  userId: "user-1",
  subject: "Biology",
  status: "active",
  plannedMinutes: 45,
  extendedMinutes: 0,
  pausedAt: null,
  totalPausedMs: 0,
  startedAt,
  endedAt: null,
  createdAt: startedAt,
};

describe("sessionStudyMinutes", () => {
  it("counts wall time for a completed session without pauses", () => {
    expect(
      sessionStudyMinutes({
        startedAt,
        endedAt: new Date("2026-10-23T10:50:00.000Z"),
        pausedAt: null,
        totalPausedMs: 0,
      }),
    ).toBe(50);
  });

  it("subtracts completed pauses", () => {
    expect(
      sessionStudyMinutes({
        startedAt,
        endedAt: new Date("2026-10-23T11:00:00.000Z"),
        pausedAt: null,
        totalPausedMs: 10 * 60_000,
      }),
    ).toBe(50);
  });

  it("subtracts an open pause up to now", () => {
    expect(
      sessionStudyMinutes(
        {
          startedAt,
          endedAt: null,
          pausedAt: new Date("2026-10-23T10:20:00.000Z"),
          totalPausedMs: 0,
        },
        new Date("2026-10-23T10:30:00.000Z"),
      ),
    ).toBe(20);
  });

  it("never returns a negative duration", () => {
    expect(
      sessionStudyMinutes({
        startedAt,
        endedAt: new Date("2026-10-23T09:59:00.000Z"),
        pausedAt: null,
        totalPausedMs: 0,
      }),
    ).toBe(0);
  });
});

describe("toStudySessionResult", () => {
  it("wraps an active session with live study minutes", () => {
    expect(toStudySessionResult(activeSession, new Date("2026-10-23T10:30:00.000Z"))).toEqual({
      session: activeSession,
      studyMinutes: 30,
    });
  });
});
