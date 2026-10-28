import { prisma } from "../lib/prisma";

export interface AiQuotaSnapshot {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
}

export interface AiTokenUsage {
  input_tokens?: number;
  output_tokens?: number;
  inputTokens?: number;
  outputTokens?: number;
}

type UsageStore = typeof prisma;

export function startOfUtcDay(now: Date = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
}

/**
 * Reserves one request for the UTC day. The check happens after the atomic
 * increment so concurrent turns cannot slip past the limit together.
 */
export async function consumeAiQuota(
  userId: string,
  limit: number,
  now: Date = new Date(),
  client: UsageStore = prisma
): Promise<AiQuotaSnapshot> {
  const day = startOfUtcDay(now);

  const usage = await client.aiUsage.upsert({
    where: { userId_day: { userId, day } },
    create: { userId, day, requests: 1 },
    update: { requests: { increment: 1 } },
    select: { requests: true },
  });

  return {
    allowed: usage.requests <= limit,
    used: usage.requests,
    limit,
    remaining: Math.max(0, limit - usage.requests),
  };
}

export async function getAiUsage(
  userId: string,
  now: Date = new Date(),
  client: UsageStore = prisma
) {
  const usage = await client.aiUsage.findUnique({
    where: { userId_day: { userId, day: startOfUtcDay(now) } },
    select: { requests: true, inputTokens: true, outputTokens: true },
  });

  return {
    requests: usage?.requests ?? 0,
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
  };
}

export async function recordAiTokenUsage(
  userId: string,
  usage: AiTokenUsage | null | undefined,
  now: Date = new Date(),
  client: UsageStore = prisma
): Promise<void> {
  const input = usage?.input_tokens ?? usage?.inputTokens ?? 0;
  const output = usage?.output_tokens ?? usage?.outputTokens ?? 0;
  if (input <= 0 && output <= 0) return;

  const day = startOfUtcDay(now);

  await client.aiUsage.upsert({
    where: { userId_day: { userId, day } },
    create: {
      userId,
      day,
      requests: 0,
      inputTokens: input,
      outputTokens: output,
    },
    update: {
      inputTokens: { increment: input },
      outputTokens: { increment: output },
    },
  });
}
