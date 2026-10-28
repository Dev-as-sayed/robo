import { DateTime } from "luxon";
import { prisma } from "../lib/prisma";
import { dayKey, tzOffsetMinutes } from "../lib/time";

export * from "./daily";

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export interface AnalyticsSummary {
  totalStudyHours: number;
  completedTasks: number;
  completedQuizzes: number;
  activeReminders: number;
  upcomingExams: number;
  streakDays: number;
  narrative: string;
}

export interface AnalyticsBySubject {
  subject: string;
  studyHours: number;
  completedTasks: number;
  quizAverage: number;
  recentActivities: string[];
}

type AnalyticsRange = "day" | "week" | "month" | "year";

const RANGE_UNIT: Record<AnalyticsRange, "day" | "week" | "month" | "year"> = {
  day: "day",
  week: "week",
  month: "month",
  year: "year",
};

const RANGE_LABEL: Record<AnalyticsRange, string> = {
  day: "today",
  week: "this week",
  month: "this month",
  year: "this year",
};

export function buildAnalyticsNarrative(
  summary: Omit<AnalyticsSummary, "narrative">,
  range: AnalyticsRange
): string {
  const pieces: string[] = [];
  if (summary.totalStudyHours > 0) {
    pieces.push(
      `${summary.totalStudyHours} hour${summary.totalStudyHours === 1 ? "" : "s"} studied`
    );
  }
  if (summary.completedTasks > 0) {
    pieces.push(
      `${summary.completedTasks} task${summary.completedTasks === 1 ? "" : "s"} completed`
    );
  }
  if (summary.completedQuizzes > 0) {
    pieces.push(
      `${summary.completedQuizzes} quiz${summary.completedQuizzes === 1 ? "" : "zes"} done`
    );
  }
  if (summary.streakDays > 0) {
    pieces.push(`a ${summary.streakDays}-day streak`);
  }

  const activity =
    pieces.length > 0
      ? pieces.join(", ")
      : "no study activity recorded";
  const ahead =
    summary.upcomingExams > 0
      ? ` ${summary.upcomingExams} exam${summary.upcomingExams === 1 ? "" : "s"} ahead.`
      : "";

  return `${activity.charAt(0).toUpperCase()}${activity.slice(1)} ${RANGE_LABEL[range]}.${ahead}`;
}

function previousDayKey(key: string): string {
  const date = new Date(`${key}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/**
 * Consecutive active days ending today. A day with no activity yet does not break a
 * streak that is still alive through yesterday, which is how habit trackers usually
 * behave before the student's first task of the day.
 */
export function calculateStreak(activityDays: Iterable<string>, todayKey: string): number {
  const days = new Set(activityDays);
  let cursor = todayKey;

  if (!days.has(cursor)) {
    cursor = previousDayKey(todayKey);
  }

  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = previousDayKey(cursor);
  }

  return streak;
}

interface SessionTimes {
  startedAt: Date;
  endedAt: Date | null;
  pausedAt: Date | null;
  totalPausedMs: number;
}

function sessionMinutes(session: SessionTimes, now: Date): number {
  const end = Math.min((session.endedAt ?? now).getTime(), now.getTime());
  const openPause = session.pausedAt
    ? Math.max(0, end - session.pausedAt.getTime())
    : 0;
  const activeMs = Math.max(
    0,
    end - session.startedAt.getTime() - session.totalPausedMs - openPause
  );

  return activeMs / MINUTE_MS;
}

export async function getAnalyticsSummary(
  userId: string,
  filters: { range?: AnalyticsRange }
): Promise<AnalyticsSummary> {
  const range = filters.range ?? "week";
  const now = new Date();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  const timezone = user?.timezone || "UTC";
  const localNow = DateTime.fromJSDate(now, { zone: timezone });
  const start = localNow.startOf(RANGE_UNIT[range]).toJSDate();
  const todayStart = localNow.startOf("day").toJSDate();
  const historyStart = new Date(now.getTime() - 90 * DAY_MS);

  const [
    sessions,
    completedTodos,
    completedQuizzes,
    activeReminders,
    upcomingExams,
    completedForStreak,
    sessionsForStreak,
    storedStats,
    currentSessions,
    currentTodos,
    currentQuizzes,
  ] = await Promise.all([
    prisma.studySession.findMany({
      where: { userId, startedAt: { gte: start } },
      select: { startedAt: true, endedAt: true, pausedAt: true, totalPausedMs: true },
    }),
    prisma.todo.count({
      where: { userId, status: "completed", completedAt: { gte: start } },
    }),
    prisma.quizAttempt.count({
      where: { userId, answeredAt: { gte: start } },
    }),
    prisma.reminder.count({
      where: { userId, status: "active", nextAt: { not: null } },
    }),
    prisma.exam.count({
      where: {
        userId,
        date: { gte: now },
        status: { in: ["draft", "active"] },
      },
    }),
    prisma.todo.findMany({
      where: {
        userId,
        status: "completed",
        completedAt: { gte: historyStart },
      },
      select: { completedAt: true },
    }),
    prisma.studySession.findMany({
      where: { userId, startedAt: { gte: historyStart } },
      select: { startedAt: true },
    }),
    prisma.dailyStats.findMany({
      where: {
        userId,
        date: { gte: new Date(`${dayKey(start, tzOffsetMinutes(timezone, start))}T00:00:00.000Z`), lt: new Date(`${dayKey(todayStart, tzOffsetMinutes(timezone, todayStart))}T00:00:00.000Z`) },
      },
      select: {
        studyMinutes: true,
        completedTasks: true,
        completedQuizzes: true,
        quizScoreSum: true,
        quizScoreCount: true,
      },
    }),
    prisma.studySession.findMany({
      where: { userId, startedAt: { gte: todayStart, lte: now } },
      select: { startedAt: true, endedAt: true, pausedAt: true, totalPausedMs: true },
    }),
    prisma.todo.count({
      where: { userId, status: "completed", completedAt: { gte: todayStart } },
    }),
    prisma.quizAttempt.count({
      where: { userId, answeredAt: { gte: todayStart } },
    }),
  ]);

  let totalMinutes = sessions.reduce(
    (total, session) => total + sessionMinutes(session, now),
    0
  );
  let totalCompletedTasks = completedTodos;
  let totalCompletedQuizzes = completedQuizzes;

  // Aggregates cover completed days; today is still live until the nightly job runs.
  if (storedStats.length > 0) {
    const storedMinutes = storedStats.reduce((total, stat) => total + stat.studyMinutes, 0);
    const currentMinutes = currentSessions.reduce(
      (total, session) => total + sessionMinutes(session, now),
      0
    );

    totalMinutes = storedMinutes + currentMinutes;
    totalCompletedTasks =
      storedStats.reduce((total, stat) => total + stat.completedTasks, 0) + currentTodos;
    totalCompletedQuizzes =
      storedStats.reduce((total, stat) => total + stat.completedQuizzes, 0) + currentQuizzes;
  }

  const activityDays = new Set<string>();
  for (const todo of completedForStreak) {
    if (!todo.completedAt) continue;
    activityDays.add(
      dayKey(todo.completedAt, tzOffsetMinutes(timezone, todo.completedAt))
    );
  }
  for (const session of sessionsForStreak) {
    activityDays.add(
      dayKey(session.startedAt, tzOffsetMinutes(timezone, session.startedAt))
    );
  }

  const summary = {
    totalStudyHours: Math.round((totalMinutes / 60) * 10) / 10,
    completedTasks: totalCompletedTasks,
    completedQuizzes: totalCompletedQuizzes,
    activeReminders,
    upcomingExams,
    streakDays: calculateStreak(activityDays, dayKey(now, tzOffsetMinutes(timezone, now))),
  };

  return {
    ...summary,
    narrative: buildAnalyticsNarrative(summary, range),
  };
}

export async function getAnalyticsBySubject(
  userId: string,
  subjectId: string
): Promise<AnalyticsBySubject> {
  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, userId },
    select: { id: true, name: true },
  });

  if (!subject) {
    throw new Error("SUBJECT_NOT_FOUND");
  }

  const [todos, sessions, attempts] = await Promise.all([
    prisma.todo.findMany({
      where: { userId, subject: subject.name },
      select: { title: true, status: true, createdAt: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.studySession.findMany({
      where: { userId, subject: subject.name },
      select: { startedAt: true, endedAt: true, pausedAt: true, totalPausedMs: true },
    }),
    prisma.quizAttempt.findMany({
      where: { userId, quiz: { subject: subject.name } },
      select: { score: true, answeredAt: true },
      orderBy: { answeredAt: "desc" },
      take: 50,
    }),
  ]);

  const studyMinutes = sessions.reduce(
    (total, session) => total + sessionMinutes(session, new Date()),
    0
  );
  const scores = attempts
    .map(attempt => attempt.score)
    .filter((score): score is number => score !== null);
  const quizAverage =
    scores.length > 0
      ? Math.round(scores.reduce((total, score) => total + score, 0) / scores.length)
      : 0;

  const recentActivities = [
    ...todos
      .filter(todo => todo.status === "completed")
      .map(todo => `Completed task: ${todo.title}`),
    ...attempts
      .filter(attempt => attempt.answeredAt)
      .map(attempt => `Quiz score: ${attempt.score ?? 0}%`),
  ].slice(0, 10);

  return {
    subject: subject.name,
    studyHours: Math.round((studyMinutes / 60) * 10) / 10,
    completedTasks: todos.filter(todo => todo.status === "completed").length,
    quizAverage,
    recentActivities,
  };
}
