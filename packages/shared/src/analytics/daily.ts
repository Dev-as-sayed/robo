import { DateTime } from "luxon";
import { prisma } from "../lib/prisma";

const MINUTE_MS = 60_000;

function dateOnly(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

/**
 * Rolls one user's local day into `DailyStats`. Sessions are clipped to the day
 * boundaries, and the upsert makes a re-run idempotent.
 */
export async function aggregateDailyStatsForUser(
  userId: string,
  dateKey: string,
  timezone: string
): Promise<void> {
  const localDay = DateTime.fromISO(dateKey, { zone: timezone }).startOf("day");
  if (!localDay.isValid) {
    throw new Error(`INVALID_DATE: ${dateKey}`);
  }

  const start = localDay.toJSDate();
  const end = localDay.plus({ days: 1 }).toJSDate();

  const [sessions, completedTasks, attempts] = await Promise.all([
    prisma.studySession.findMany({
      where: { userId, startedAt: { gte: start, lt: end } },
      select: { startedAt: true, endedAt: true },
    }),
    prisma.todo.count({
      where: {
        userId,
        status: "completed",
        completedAt: { gte: start, lt: end },
      },
    }),
    prisma.quizAttempt.findMany({
      where: { userId, answeredAt: { gte: start, lt: end } },
      select: { score: true },
    }),
  ]);

  const studyMinutes = Math.round(
    sessions.reduce((total, session) => {
      if (!session.endedAt) return total;
      const from = Math.max(session.startedAt.getTime(), start.getTime());
      const to = Math.min(session.endedAt.getTime(), end.getTime());
      return total + Math.max(0, to - from) / MINUTE_MS;
    }, 0)
  );

  const scores = attempts
    .map(attempt => attempt.score)
    .filter((score): score is number => score !== null);

  await prisma.dailyStats.upsert({
    where: {
      userId_date: {
        userId,
        date: dateOnly(dateKey),
      },
    },
    create: {
      userId,
      date: dateOnly(dateKey),
      studyMinutes,
      completedTasks,
      completedQuizzes: attempts.length,
      quizScoreSum: scores.reduce((total, score) => total + score, 0),
      quizScoreCount: scores.length,
    },
    update: {
      studyMinutes,
      completedTasks,
      completedQuizzes: attempts.length,
      quizScoreSum: scores.reduce((total, score) => total + score, 0),
      quizScoreCount: scores.length,
    },
  });
}

/** Aggregates yesterday for every user in their own timezone. */
export async function aggregateYesterdayForAllUsers(now = new Date()): Promise<number> {
  const users = await prisma.user.findMany({
    select: { id: true, timezone: true },
  });

  let aggregated = 0;
  for (const user of users) {
    const dateKey = DateTime.fromJSDate(now, { zone: user.timezone || "UTC" })
      .minus({ days: 1 })
      .toISODate();

    if (!dateKey) continue;

    await aggregateDailyStatsForUser(user.id, dateKey, user.timezone || "UTC");
    aggregated += 1;
  }

  return aggregated;
}
