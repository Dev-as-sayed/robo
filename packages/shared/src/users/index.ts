import argon2 from "argon2";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { revokeAllTokensForUser } from "../auth";
import { toPublicUser } from "./select";

export * from "./roles";
export * from "./admin";

export async function getAccountState(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, status: true },
  });
}

export type NudgeSettings = {
  enabled: boolean;
  maxPerDay: number;
  types: {
    reminders: boolean;
    study: boolean;
    exams: boolean;
    tasks: boolean;
  };
};

export interface UpdateUserInput {
  name?: string;
  password?: string;
  locale?: string;
  timezone?: string;
  quietHours?: { enabled: boolean; start: string; end: string } | null;
  wakePhrase?: string;
  nudgeSettings?: NudgeSettings | null;
  cloudAiForDocs?: boolean;
  guardianConsent?: boolean;
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  return toPublicUser(user);
}

export async function updateMe(userId: string, data: UpdateUserInput) {
  const updateData: Prisma.UserUpdateInput = {};

  if (data.name !== undefined) {
    updateData.name = data.name;
  }

  if (data.locale !== undefined) {
    updateData.locale = data.locale;
  }

  if (data.timezone !== undefined) {
    updateData.timezone = data.timezone;
  }

  if (data.quietHours !== undefined) {
    updateData.quietHours = data.quietHours === null ? Prisma.DbNull : data.quietHours;
  }

  if (data.wakePhrase !== undefined) {
    updateData.wakePhrase = data.wakePhrase;
  }

  if (data.nudgeSettings !== undefined) {
    updateData.nudgeSettings =
      data.nudgeSettings === null ? Prisma.DbNull : data.nudgeSettings;
  }

  if (data.cloudAiForDocs !== undefined) {
    updateData.cloudAiForDocs = data.cloudAiForDocs;
  }

  if (data.guardianConsent !== undefined) {
    updateData.guardianConsent = data.guardianConsent;
  }

  const passwordChanged = Boolean(data.password);

  if (data.password) {
    updateData.passwordHash = await argon2.hash(data.password);
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: updateData,
  });

  if (passwordChanged) {
    await revokeAllTokensForUser(userId);
  }

  return toPublicUser(user);
}

export async function exportUserData(userId: string) {
  const [
    user,
    devices,
    todos,
    reminders,
    scheduleEntries,
    exams,
    studyPlans,
    documents,
    quizzes,
    quizAttempts,
    contacts,
    studySessions,
    conversations,
    actionLogs,
  ] = await prisma.$transaction([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.device.findMany({
      where: { userId },
      select: {
        id: true,
        deviceId: true,
        name: true,
        firmwareVersion: true,
        locale: true,
        status: true,
        lastSeenAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.todo.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.reminder.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.scheduleEntry.findMany({
      where: { userId },
      include: { exceptions: true },
      orderBy: { startAt: "asc" },
    }),
    prisma.exam.findMany({
      where: { userId },
      orderBy: { date: "asc" },
    }),
    prisma.studyPlan.findMany({
      where: { userId },
      include: { dailyTasks: { orderBy: { day: "asc" } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.document.findMany({
      where: { userId },
      select: {
        id: true,
        filename: true,
        originalName: true,
        size: true,
        mimeType: true,
        status: true,
        subject: true,
        chunkCount: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.quiz.findMany({
      where: { userId },
      include: { questions: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.quizAttempt.findMany({
      where: { userId },
      include: { quiz: { select: { id: true, title: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.contact.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.studySession.findMany({
      where: { userId },
      orderBy: { startedAt: "asc" },
    }),
    prisma.conversation.findMany({
      where: { userId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.actionLog.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  return {
    exportedAt: new Date().toISOString(),
    user: toPublicUser(user),
    devices,
    todos,
    reminders,
    scheduleEntries,
    exams,
    studyPlans,
    documents,
    quizzes,
    quizAttempts,
    contacts,
    studySessions,
    conversations,
    actionLogs,
  };
}

export async function deleteMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  await prisma.user.delete({ where: { id: userId } });

  return { deleted: true };
}
