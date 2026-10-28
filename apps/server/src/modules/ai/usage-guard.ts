import {
  consumeAiQuota,
  recordAiTokenUsage,
  type AiTokenUsage,
} from "@robo/shared/ai-usage";
import { env } from "../../config/env";
import logger from "../../lib/logger";

export async function reserveQuota(userId: string): Promise<void> {
  try {
    const quota = await consumeAiQuota(userId, env.AI_DAILY_REQUEST_LIMIT);
    if (!quota.allowed) {
      throw new Error("AI_QUOTA_EXCEEDED");
    }
  } catch (error) {
    if (error instanceof Error && error.message === "AI_QUOTA_EXCEEDED") {
      throw error;
    }
    // Quota storage is best-effort; an outage must not take chatting down.
    logger.warn({ err: error, userId }, "AI quota check unavailable");
  }
}

export function recordUsage(
  userId: string,
  usage: AiTokenUsage | null | undefined
): void {
  void recordAiTokenUsage(userId, usage).catch((error: unknown) => {
    logger.warn({ err: error, userId }, "failed to record AI token usage");
  });
}
