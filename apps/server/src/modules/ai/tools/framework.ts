import { tool } from "@langchain/core/tools";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { isGraphInterrupt } from "@langchain/langgraph";
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
    missing?: string[];
    question?: string;
  };
}

export interface ToolSuccessPayload<T = unknown> {
  ok: true;
  data: T;
  requiresConfirmation?: boolean;
  message?: string;
}

export interface AgentConfirmationRequest {
  type: "confirmation";
  action: "delete_todo" | "cancel_reminder";
  targetId: string;
  title: string;
  prompt: string;
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
  DOCUMENT_NOT_INDEXED: "That document is still being indexed or has no searchable text.",
  QUIZ_NOT_FOUND: "That quiz could not be found.",
  RAG_NOT_CONFIGURED: "Document search is not configured yet.",
  INVALID_DATETIME: "A date or time in the request was not valid.",
  STORAGE_ERROR: "The requested data could not be saved.",
  NO_UPCOMING_CLASS: "There is no upcoming class to schedule that after.",
  MISSING_ARGUMENTS: "Some required details are missing; ask the student for them.",
};

const FIELD_QUESTIONS: Record<string, string> = {
  title: "What should I call it?",
  text: "What should I remind you about?",
  at: "When should that happen?",
  dueAt: "When is it due?",
  contactId: "Who is this for?",
  recipientName: "Who should I contact?",
  body: "What should the message say?",
  query: "What should I search for?",
  subject: "Which subject is this for?",
  topic: "Which topic should I focus on?",
  questionCount: "How many questions should I generate?",
  answers: "What answers should I record?",
  quizId: "Which quiz should I use?",
  examId: "Which exam is this for?",
  reminderId: "Which reminder should I change?",
  todoId: "Which task should I change?",
  pendingActionId: "Which action should I confirm or cancel?",
  from: "What date should the schedule window start?",
  to: "What date should the schedule window end?",
};

const CODE_QUESTIONS: Record<string, string> = {
  NO_UPCOMING_CLASS: "When should I remind you to call instead?",
  INVALID_DATETIME: "What date and time did you mean?",
  MISSING_ARGUMENTS: "Could you share the missing details?",
};

function questionForFields(missing: string[]): string {
  for (const field of missing) {
    const last = field.split(".").pop() ?? field;
    if (FIELD_QUESTIONS[last]) {
      return FIELD_QUESTIONS[last];
    }
  }

  return "Could you share the missing details?";
}

function clarificationPayload(
  error: z.ZodError,
  rawInput: unknown
): ToolErrorPayload {
  const missing = Array.from(
    new Set(
      error.issues.map((issue) =>
        issue.path.length > 0 ? issue.path.join(".") : "request"
      )
    )
  );
  const question = questionForFields(missing);
  logger.info(
    { missing, input: rawInput, question },
    "tool input needs clarification"
  );

  return {
    ok: false,
    error: {
      code: "MISSING_ARGUMENTS",
      message: `I need ${missing.join(", ")}. ${question}`,
      missing,
      question,
    },
  };
}

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
        ...(CODE_QUESTIONS[code] ? { question: CODE_QUESTIONS[code] } : {}),
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
  const base = tool(
    async (input: z.infer<Schema>) => {
      const startedAt = Date.now();
      let payload: ToolPayload;

      try {
        payload = await options.invoke(input, context);
      } catch (error) {
        if (isGraphInterrupt(error)) {
          throw error;
        }
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

  // Validate before LangChain's generic "input did not match schema" error so the
  // model always receives a stable, answerable clarification in one round trip.
  const originalInvoke = base.invoke.bind(base);
  base.invoke = (async (
    input: unknown,
    config?: Parameters<typeof base.invoke>[1]
  ) => {
    const raw =
      input && typeof input === "object" && "args" in input
        ? (input as { args: unknown }).args
        : input;
    const parsed = options.schema.safeParse(raw);

    if (!parsed.success) {
      return JSON.stringify(clarificationPayload(parsed.error, raw));
    }

    return originalInvoke(input as Parameters<typeof base.invoke>[0], config);
  }) as typeof base.invoke;

  return base;
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
