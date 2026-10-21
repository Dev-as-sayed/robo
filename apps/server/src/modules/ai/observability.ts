import { createHash } from "node:crypto";
import { env } from "../../config/env";
import logger from "../../lib/logger";

export interface TraceContext {
  userId: string;
  conversationId: string;
}

function pseudonymize(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

export async function getTraceCallbacks(context: TraceContext) {
  if (!env.LANGFUSE_PUBLIC_KEY || !env.LANGFUSE_SECRET_KEY) {
    return [];
  }

  process.env.LANGFUSE_PUBLIC_KEY = env.LANGFUSE_PUBLIC_KEY;
  process.env.LANGFUSE_SECRET_KEY = env.LANGFUSE_SECRET_KEY;
  process.env.LANGFUSE_HOST = env.LANGFUSE_HOST;

  try {
    const { CallbackHandler } = await import("@langfuse/langchain");
    return [
      new CallbackHandler({
        userId: pseudonymize(context.userId),
        sessionId: context.conversationId,
        tags: ["robo", "agent"],
        traceMetadata: { environment: env.NODE_ENV },
      }),
    ];
  } catch (error) {
    logger.warn({ err: error }, "langfuse tracing unavailable");
    return [];
  }
}
