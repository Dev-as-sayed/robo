import { tool } from "@langchain/core/tools";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { z } from "zod";
import { logAction, type ActionLogStatus } from "@robo/shared/action-logs";
import logger from "../../../lib/logger";

export interface ToolContext {
  userId: string;
  conversationId?: string;
  timezone: string;
  locale: string;
  now: Date;
}

export interface ToolErrorPayload {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

export interface ToolSuccessPayload<T = unknown> {
  ok: true;
  data: T;
  requiresConfirmation?: boolean;
  message?: string;
}

export type ToolPayload<T = unknown> = ToolSuccessPayload<T> | ToolErrorPayload;

interface CreateToolOptions<Schema extends z.ZodObject<z.ZodRawShape>> {
  name: string;
  description: string;
  schema: Schema;
  invoke: (input: z.infer<Schema>, context: ToolContext) => Promise<ToolSuccessPayload>;
}

const ERROR_MESSAGES: Record<string, string> = {
  TODO_NOT_FOUND: "That todo could not be found.",
  REMINDER_NOT_FOUND: "That reminder could not be found.",
  SCHEDULE_NOT_FOUND: "That schedule entry could not be found.",
  EXAM_NOT_FOUND: "That exam could not be found.",
  PLAN_NOT_FOUND: "That study plan could not be found.",
  CONTACT_NOT_FOUND: "That contact could not be found.",
  DOCUMENT_NOT_FOUND: "That document could not be found.",
  QUIZ_NOT_FOUND: "That quiz could not be found.",
  RAG_NOT_CONFIGURED: "Document search is not configured yet.",
  INVALID_DATETIME: "A date or time in the request was not valid.",
  STORAGE_ERROR: "The requested data could not be saved.",
};

function describeError(error: unknown): ToolErrorPayload {
  if (error instanceof z.ZodError) {
    return {
      ok: false,
      error: {
        code: "INVALID_ARGUMENTS",
        message: error.issues.map((issue) => issue.message).join("; "),
      },
    };
  }

  if (error instanceof Error) {
    const code = error.message;
    return {
      ok: false,
      error: {
        code,
        message: ERROR_MESSAGES[code] ?? "The action could not be completed.",
      },
    };
  }

  return {
    ok: false,
    error: { code: "TOOL_FAILED", message: "The action could not be completed." },
  };
}

async function writeActionLog(data: {
  context: ToolContext;
  toolName: string;
  input: unknown;
  output: unknown;
  status: ActionLogStatus;
  error?: string | null;
  durationMs: number;
}): Promise<void> {
  try {
    await logAction({
      userId: data.context.userId,
      conversationId: data.context.conversationId,
      toolName: data.toolName,
      input: data.input,
      output: data.output,
      status: data.status,
      error: data.error,
      durationMs: data.durationMs,
    });
  } catch (error) {
    logger.warn({ err: error, tool: data.toolName }, "failed to write action log");
  }
}

export function createRoboTool<Schema extends z.ZodObject<z.ZodRawShape>>(
  options: CreateToolOptions<Schema>,
  context: ToolContext
): StructuredToolInterface {
  return tool(
    async (input: z.infer<Schema>) => {
      const startedAt = Date.now();
      let payload: ToolPayload;

      try {
        payload = await options.invoke(input, context);
      } catch (error) {
        payload = describeError(error);
      }

      const durationMs = Date.now() - startedAt;
      const status: ActionLogStatus =
        payload.ok && payload.requiresConfirmation
          ? "CONFIRMATION_REQUIRED"
          : payload.ok
            ? "SUCCESS"
            : "ERROR";

      await writeActionLog({
        context,
        toolName: options.name,
        input,
        output: payload.ok ? payload.data : null,
        status,
        error: payload.ok ? null : payload.error.code,
        durationMs,
      });

      if (!payload.ok) {
        logger.warn(
          {
            userId: context.userId,
            conversationId: context.conversationId,
            tool: options.name,
            error: payload.error,
            durationMs,
          },
          "agent tool failed"
        );
      }

      return JSON.stringify(payload);
    },
    {
      name: options.name,
      description: options.description,
      schema: options.schema,
    }
  );
}

export function parseDateTime(value: string, _field: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("INVALID_DATETIME");
  }

  if (!value.includes("T") && !value.includes(":")) {
    return parsed;
  }

  return parsed;
}

export function serializeDate(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}
