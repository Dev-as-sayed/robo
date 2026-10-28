import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

export type ActionLogStatus = "SUCCESS" | "ERROR" | "CONFIRMATION_REQUIRED";

export interface ActionLogInput {
  userId: string;
  conversationId?: string | null;
  toolName: string;
  input: unknown;
  output?: unknown;
  status: ActionLogStatus;
  error?: string | null;
  durationMs: number;
}

export interface ActionLogEntry {
  id: string;
  userId: string;
  conversationId: string | null;
  toolName: string;
  input: unknown;
  output: unknown;
  status: ActionLogStatus;
  error: string | null;
  durationMs: number;
  createdAt: Date;
}

export async function logAction(data: ActionLogInput) {
  return prisma.actionLog.create({
    data: {
      userId: data.userId,
      conversationId: data.conversationId ?? null,
      toolName: data.toolName,
      input: data.input as Prisma.InputJsonValue,
      output:
        data.output === undefined || data.output === null
          ? Prisma.JsonNull
          : (data.output as Prisma.InputJsonValue),
      status: data.status,
      error: data.error ?? null,
      durationMs: data.durationMs,
    },
    select: {
      id: true,
      userId: true,
      conversationId: true,
      toolName: true,
      input: true,
      output: true,
      status: true,
      error: true,
      durationMs: true,
      createdAt: true,
    },
  });
}

export async function getActionLogs(
  userId: string,
  limit = 50
): Promise<ActionLogEntry[]> {
  return prisma.actionLog.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    select: {
      id: true,
      userId: true,
      conversationId: true,
      toolName: true,
      input: true,
      output: true,
      status: true,
      error: true,
      durationMs: true,
      createdAt: true,
    },
  });
}

/** Successful or confirmation-pending actions from one turn, for display rendering. */
export async function getActionLogsForConversationSince(
  userId: string,
  conversationId: string,
  since: Date,
  limit = 20
): Promise<ActionLogEntry[]> {
  return prisma.actionLog.findMany({
    where: {
      userId,
      conversationId,
      createdAt: { gte: since },
      status: { in: ["SUCCESS", "CONFIRMATION_REQUIRED"] },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit,
    select: {
      id: true,
      userId: true,
      conversationId: true,
      toolName: true,
      input: true,
      output: true,
      status: true,
      error: true,
      durationMs: true,
      createdAt: true,
    },
  });
}
