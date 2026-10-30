import { prisma } from "../lib/prisma";

const sessionSelect = {
  id: true,
  userId: true,
  subject: true,
  status: true,
  plannedMinutes: true,
  extendedMinutes: true,
  pausedAt: true,
  totalPausedMs: true,
  startedAt: true,
  endedAt: true,
  createdAt: true,
} as const;

export type StudySessionStatus = "active" | "paused" | "ended";

export interface StudySession {
  id: string;
  userId: string;
  subject: string | null;
  status: StudySessionStatus;
  plannedMinutes: number | null;
  extendedMinutes: number;
  pausedAt: Date | null;
  totalPausedMs: number;
  startedAt: Date;
  endedAt: Date | null;
  createdAt: Date;
}

export interface StudySessionResult {
  session: StudySession;
  studyMinutes: number;
}

/** Active study time excludes completed and currently-open pauses. */
export function sessionStudyMinutes(
  session: Pick<StudySession, "startedAt" | "endedAt" | "pausedAt" | "totalPausedMs">,
  now = new Date(),
): number {
  const end = session.endedAt ?? now;
  const openPause = session.pausedAt ? Math.max(0, end.getTime() - session.pausedAt.getTime()) : 0;
  const activeMs = Math.max(
    0,
    end.getTime() - session.startedAt.getTime() - session.totalPausedMs - openPause,
  );

  return Math.round(activeMs / 60_000);
}

/** Wraps a session with the live study-minute total used by session APIs. */
export function toStudySessionResult(session: StudySession, now = new Date()): StudySessionResult {
  return { session, studyMinutes: sessionStudyMinutes(session, now) };
}

export async function getActiveStudySession(userId: string): Promise<StudySession | null> {
  return prisma.studySession.findFirst({
    where: { userId, status: { in: ["active", "paused"] } },
    orderBy: { startedAt: "desc" },
    select: sessionSelect,
  });
}

export async function startStudySession(
  userId: string,
  data: { subject?: string; plannedMinutes?: number } = {},
  now = new Date(),
): Promise<StudySessionResult> {
  const active = await getActiveStudySession(userId);
  if (active) {
    throw new Error("SESSION_ALREADY_ACTIVE");
  }

  const session = await prisma.studySession.create({
    data: {
      userId,
      subject: data.subject,
      plannedMinutes: data.plannedMinutes,
      status: "active",
      startedAt: now,
    },
    select: sessionSelect,
  });

  return toStudySessionResult(session, now);
}

export async function pauseStudySession(
  userId: string,
  sessionId: string,
  now = new Date(),
): Promise<StudySessionResult> {
  const session = await prisma.studySession.findFirst({
    where: { id: sessionId, userId, status: "active" },
    select: sessionSelect,
  });

  if (!session) {
    throw new Error("SESSION_NOT_ACTIVE");
  }

  const updated = await prisma.studySession.update({
    where: { id: sessionId, userId },
    data: { status: "paused", pausedAt: now },
    select: sessionSelect,
  });

  return toStudySessionResult(updated, now);
}

export async function resumeStudySession(
  userId: string,
  sessionId: string,
  now = new Date(),
): Promise<StudySessionResult> {
  const session = await prisma.studySession.findFirst({
    where: { id: sessionId, userId, status: "paused" },
    select: sessionSelect,
  });

  if (!session) {
    throw new Error("SESSION_NOT_PAUSED");
  }

  const pausedMs = session.pausedAt ? Math.max(0, now.getTime() - session.pausedAt.getTime()) : 0;
  const updated = await prisma.studySession.update({
    where: { id: sessionId, userId },
    data: {
      status: "active",
      pausedAt: null,
      totalPausedMs: { increment: pausedMs },
    },
    select: sessionSelect,
  });

  return toStudySessionResult(updated, now);
}

export async function extendStudySession(
  userId: string,
  sessionId: string,
  minutes: number,
  now = new Date(),
): Promise<StudySessionResult> {
  const session = await prisma.studySession.findFirst({
    where: { id: sessionId, userId, status: { in: ["active", "paused"] } },
    select: sessionSelect,
  });

  if (!session) {
    throw new Error("SESSION_NOT_ACTIVE");
  }

  const updated = await prisma.studySession.update({
    where: { id: sessionId, userId },
    data: {
      plannedMinutes: (session.plannedMinutes ?? 0) + minutes,
      extendedMinutes: { increment: minutes },
    },
    select: sessionSelect,
  });

  return toStudySessionResult(updated, now);
}

export async function endStudySession(
  userId: string,
  sessionId: string,
  now = new Date(),
): Promise<StudySessionResult> {
  const session = await prisma.studySession.findFirst({
    where: { id: sessionId, userId, status: { in: ["active", "paused"] } },
    select: sessionSelect,
  });

  if (!session) {
    throw new Error("SESSION_NOT_ACTIVE");
  }

  const pausedMs = session.pausedAt ? Math.max(0, now.getTime() - session.pausedAt.getTime()) : 0;
  const updated = await prisma.studySession.update({
    where: { id: sessionId, userId },
    data: {
      status: "ended",
      endedAt: now,
      pausedAt: null,
      totalPausedMs: { increment: pausedMs },
    },
    select: sessionSelect,
  });

  return toStudySessionResult(updated, now);
}

export async function listStudySessions(userId: string, limit = 20): Promise<StudySessionResult[]> {
  const now = new Date();
  const sessions = await prisma.studySession.findMany({
    where: { userId },
    orderBy: [{ startedAt: "desc" }, { id: "desc" }],
    take: limit,
    select: sessionSelect,
  });

  return sessions.map(session => toStudySessionResult(session, now));
}
