import { prisma } from "@robo/shared/lib/prisma";
import {
  nudgeCandidates,
  nudgeDayBounds,
  nudgeLocalDay,
  normalizeNudgeSettings,
  normalizeQuietHours,
  type NudgeCandidate,
  type NudgeSettings,
  type NudgeType,
  type QuietHours,
} from "@robo/shared/nudges";
import type { Logger } from "pino";

export interface NudgeUser {
  id: string;
  timezone: string;
  quietHours: unknown;
  nudgeSettings: unknown;
}

interface NudgeContext {
  tasks: Array<{ title: string; dueAt: Date | null }>;
  exams: Array<{ title: string; date: Date }>;
  reminders: Array<{ text: string; nextAt: Date | null }>;
  studiedToday: boolean;
  sentToday: number;
  sentTypes: NudgeType[];
}

interface NudgeSchedulerOptions {
  intervalMs?: number;
  logger?: Pick<Logger, "info" | "warn" | "error">;
  listUsers?: () => Promise<NudgeUser[]>;
  loadContext?: (user: NudgeUser, now: Date, localDay: string) => Promise<NudgeContext>;
  claim?: (
    user: NudgeUser,
    candidate: NudgeCandidate,
    localDay: string
  ) => Promise<boolean>;
  deliver?: (userId: string, candidate: NudgeCandidate) => Promise<string[]>;
}

async function defaultLoadContext(
  user: NudgeUser,
  now: Date,
  localDay: string
): Promise<NudgeContext> {
  const bounds = nudgeDayBounds(now, user.timezone);
  if (!bounds) {
    return {
      tasks: [],
      exams: [],
      reminders: [],
      studiedToday: false,
      sentToday: 0,
      sentTypes: [],
    };
  }

  const { start, end } = bounds;
  const examEnd = new Date(start.getTime() + 8 * 24 * 60 * 60 * 1000);

  const [tasks, exams, reminders, studied, sent] = await Promise.all([
    prisma.todo.findMany({
      where: { userId: user.id, status: "pending", dueAt: { not: null, lte: end } },
      select: { title: true, dueAt: true },
    }),
    prisma.exam.findMany({
      where: {
        userId: user.id,
        date: { gte: start, lte: examEnd },
        status: { in: ["draft", "active"] },
      },
      select: { subject: true, date: true },
    }),
    prisma.reminder.findMany({
      where: {
        userId: user.id,
        status: "active",
        nextAt: { gt: now, lte: end },
      },
      select: { text: true, nextAt: true },
    }),
    prisma.studySession.findFirst({
      where: { userId: user.id, startedAt: { gte: start, lte: now } },
      select: { id: true },
    }),
    prisma.nudge.findMany({
      where: { userId: user.id, localDay },
      select: { type: true },
    }),
  ]);

  return {
    tasks: tasks.map(task => ({ title: task.title, dueAt: task.dueAt })),
    exams: exams.map(exam => ({ title: exam.subject, date: exam.date })),
    reminders,
    studiedToday: Boolean(studied),
    sentToday: sent.length,
    sentTypes: sent.map(row => row.type),
  };
}

async function defaultClaim(
  user: NudgeUser,
  candidate: NudgeCandidate,
  localDay: string
): Promise<boolean> {
  try {
    await prisma.nudge.create({
      data: {
        userId: user.id,
        type: candidate.type,
        localDay,
        title: candidate.title,
        body: candidate.body,
      },
    });
    return true;
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? (error as { code?: string }).code
        : undefined;
    if (code === "P2002") {
      return false;
    }
    throw error;
  }
}

export class NudgeScheduler {
  private readonly intervalMs: number;
  private readonly logger?: Pick<Logger, "info" | "warn" | "error">;
  private readonly listUsers: () => Promise<NudgeUser[]>;
  private readonly loadContext: (
    user: NudgeUser,
    now: Date,
    localDay: string
  ) => Promise<NudgeContext>;
  private readonly claim: (
    user: NudgeUser,
    candidate: NudgeCandidate,
    localDay: string
  ) => Promise<boolean>;
  private readonly deliver: (userId: string, candidate: NudgeCandidate) => Promise<string[]>;
  private timer: NodeJS.Timeout | null = null;

  constructor(options: NudgeSchedulerOptions = {}) {
    this.intervalMs = options.intervalMs ?? 300_000;
    this.logger = options.logger;
    this.listUsers =
      options.listUsers ??
      ((): Promise<NudgeUser[]> =>
        prisma.user.findMany({
          select: {
            id: true,
            timezone: true,
            quietHours: true,
            nudgeSettings: true,
          },
        }));
    this.loadContext = options.loadContext ?? defaultLoadContext;
    this.claim = options.claim ?? defaultClaim;
    this.deliver = options.deliver ?? (async (): Promise<string[]> => []);
  }

  start(): void {
    if (this.timer) return;

    this.timer = setInterval(() => {
      void this.tick().catch((error: unknown) => {
        this.logger?.error({ err: error }, "nudge tick failed");
      });
    }, this.intervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async tick(now: Date = new Date()): Promise<{ sent: number; skipped: number }> {
    const users = await this.listUsers();
    let sent = 0;
    let skipped = 0;

    for (const user of users) {
      const settings: NudgeSettings | null = normalizeNudgeSettings(user.nudgeSettings);
      if (!settings?.enabled) {
        skipped += 1;
        continue;
      }

      const localDay = nudgeLocalDay(now, user.timezone);
      if (!localDay) {
        skipped += 1;
        continue;
      }

      const context = await this.loadContext(user, now, localDay);
      const quietHours: QuietHours | null = normalizeQuietHours(user.quietHours);
      const candidates = nudgeCandidates({
        now,
        timezone: user.timezone,
        settings,
        quietHours,
        ...context,
      });

      if (candidates.length === 0) {
        skipped += 1;
        continue;
      }

      for (const candidate of candidates) {
        if (!(await this.claim(user, candidate, localDay))) {
          skipped += 1;
          continue;
        }

        try {
          const channels = await this.deliver(user.id, candidate);
          sent += 1;
          this.logger?.info(
            { userId: user.id, type: candidate.type, channels },
            "nudge sent"
          );
        } catch (error) {
          this.logger?.warn(
            { err: error, userId: user.id, type: candidate.type },
            "nudge delivery failed"
          );
        }
      }
    }

    return { sent, skipped };
  }
}
