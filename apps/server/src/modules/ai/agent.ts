import {
  HumanMessage,
  SystemMessage,
  type BaseMessage,
  type BaseMessageChunk,
} from "@langchain/core/messages";
import { RunnableBinding, type RunnableConfig } from "@langchain/core/runnables";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { Command } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import type { ChatMessage } from "@robo/shared/chat";
import { env } from "../../config/env";
import logger from "../../lib/logger";
import { getChatModels, type ChatTask } from "./llm-router";
import { classifyProviderError, toProviderError } from "./provider-errors";
import { getTraceCallbacks } from "./observability";
import { buildAgentSystemPrompt, buildHistoryMessages, extractAssistantText } from "./prompt";
import { buildTools } from "./tools";
import type { AgentConfirmationRequest } from "./tools/framework";

export interface RunAgentInput {
  userId: string;
  conversationId: string;
  content: string;
  history: ChatMessage[];
  user: {
    name: string | null;
    locale: string;
    timezone: string;
  };
  now?: Date;
  signal?: AbortSignal;
  task?: ChatTask;
  confirmationText?: string;
}

export interface AgentToolCall {
  name: string;
  args: unknown;
}

export interface RunAgentResult {
  content: string;
  toolCallCount: number;
  toolCalls: AgentToolCall[];
  model?: string;
  usage?: unknown;
  interrupted?: boolean;
}

export type ConfirmationReply = "approve" | "reject" | "ambiguous";

const AFFIRMATIVE_REPLY =
  /^(yes|yeah|yep|yup|sure|ok|okay|confirm|confirmed|do it|go ahead|proceed|please do|absolutely|definitely)\b/;
const NEGATIVE_REPLY =
  /^(no|nope|nah|don't|do not|stop|reject|never ?mind|not now|keep it)\b/;

export function classifyConfirmationReply(text: string): ConfirmationReply {
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .replace(/[.!?,;]+$/, "");

  if (NEGATIVE_REPLY.test(normalized)) {
    return "reject";
  }
  if (AFFIRMATIVE_REPLY.test(normalized)) {
    return "approve";
  }

  return "ambiguous";
}

function pendingConfirmation(
  snapshot:
    | {
        tasks?: Array<{ interrupts?: Array<{ value?: unknown }> }>;
      }
    | null
    | undefined
): AgentConfirmationRequest | null {
  for (const task of snapshot?.tasks ?? []) {
    for (const pending of task.interrupts ?? []) {
      const value = pending.value;
      if (
        value &&
        typeof value === "object" &&
        (value as { type?: unknown }).type === "confirmation"
      ) {
        return value as AgentConfirmationRequest;
      }
    }
  }

  return null;
}

function interruptResult(
  input: RunAgentInput,
  confirmation: AgentConfirmationRequest,
  startedAt: number,
  ambiguous: boolean
): RunAgentResult {
  const content = ambiguous
    ? `${confirmation.prompt} Please reply yes or no.`
    : confirmation.prompt;

  logger.info(
    {
      userId: input.userId,
      conversationId: input.conversationId,
      action: confirmation.action,
      targetId: confirmation.targetId,
      latencyMs: Date.now() - startedAt,
    },
    "AI agent paused for confirmation"
  );

  return {
    content,
    toolCallCount: 0,
    toolCalls: [],
    interrupted: true,
  };
}

let checkpointerSetup: Promise<PostgresSaver> | null = null;

async function getCheckpointer(): Promise<PostgresSaver> {
  const connectionString = env.DATABASE_URL ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("AI_MEMORY_UNAVAILABLE");
  }

  if (!checkpointerSetup) {
    checkpointerSetup = (async () => {
      const saver = PostgresSaver.fromConnString(connectionString);
      await saver.setup();
      return saver;
    })();
  }

  return checkpointerSetup;
}

function bindToolsWithFallbacks(
  tools: StructuredToolInterface[],
  task: ChatTask = "agent_tools"
) {
  const models = getChatModels(task);

  if (models.length === 0) {
    throw new Error("AI_NOT_CONFIGURED");
  }

  const bound = models.map((model) => {
    if (!model.bindTools) {
      throw new Error("AI_CONFIGURATION_INVALID");
    }

    return model.bindTools(tools);
  });
  const runnable = bound.length === 1 ? bound[0] : bound[0].withFallbacks(bound.slice(1));

  return new RunnableBinding({
    bound: runnable,
    config: {},
    kwargs: { tools } as unknown as Partial<RunnableConfig>,
  });
}

function latestAssistantText(messages: BaseMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.getType() !== "ai") {
      continue;
    }

    const text = extractAssistantText(message);
    if (text) {
      return text;
    }
  }

  return "";
}

async function prepareAgent(input: RunAgentInput) {
  const now = input.now ?? new Date();
  const tools = buildTools({
    userId: input.userId,
    conversationId: input.conversationId,
    timezone: input.user.timezone,
    locale: input.user.locale,
    now,
  });

  const llm = bindToolsWithFallbacks(tools, input.task ?? "agent_tools");
  const saver = await getCheckpointer();
  const callbacks = await getTraceCallbacks({
    userId: input.userId,
    conversationId: input.conversationId,
  });

  const agent = createReactAgent({
    llm,
    tools,
    prompt: new SystemMessage(buildAgentSystemPrompt(input.user, now)),
    checkpointer: saver,
    name: "robo",
  });

  const config: RunnableConfig = {
    configurable: { thread_id: input.conversationId },
    recursionLimit: env.AI_AGENT_STEP_LIMIT,
    callbacks,
    ...(input.signal ? { signal: input.signal } : {}),
  };

  const snapshot = await agent.getState(config);
  const existingMessages = (snapshot?.values?.messages ?? []) as BaseMessage[];
  const messages =
    existingMessages.length > 0
      ? [new HumanMessage(input.content)]
      : [...buildHistoryMessages(input.history), new HumanMessage(input.content)];
  const pending = pendingConfirmation(snapshot);
  const reply =
    pending && input.confirmationText !== undefined
      ? classifyConfirmationReply(input.confirmationText)
      : "ambiguous";

  return {
    agent,
    config,
    messages,
    startedAt: Date.now(),
    pending,
    resumeDecision: reply === "ambiguous" ? undefined : reply,
  };
}

function buildAgentResult(
  input: RunAgentInput,
  resultMessages: BaseMessage[],
  startedAt: number
): RunAgentResult {
  const content = latestAssistantText(resultMessages);

  if (!content) {
    throw new Error("AI_EMPTY_RESPONSE");
  }

  const toolCalls: AgentToolCall[] = [];
  for (const message of resultMessages) {
    if (message.getType() !== "ai") continue;
    const calls = (message as { tool_calls?: unknown[] }).tool_calls;
    if (!Array.isArray(calls)) continue;

    for (const call of calls) {
      const record =
        call && typeof call === "object"
          ? (call as Record<string, unknown>)
          : null;
      if (!record || typeof record.name !== "string") continue;
      toolCalls.push({ name: record.name, args: record.args ?? {} });
    }
  }
  const toolCallCount = toolCalls.length;

  const lastAiMessage = [...resultMessages]
    .reverse()
    .find((message) => message.getType() === "ai");
  const metadata = lastAiMessage?.response_metadata as
    | Record<string, unknown>
    | undefined;

  logger.info(
    {
      userId: input.userId,
      conversationId: input.conversationId,
      task: "agent_tools",
      latencyMs: Date.now() - startedAt,
      tools: toolCallCount,
      model: typeof metadata?.model_name === "string" ? metadata.model_name : undefined,
    },
    "AI agent response generated"
  );

  return {
    content,
    toolCallCount,
    toolCalls,
    model: typeof metadata?.model_name === "string" ? metadata.model_name : undefined,
    usage: (lastAiMessage as { usage_metadata?: unknown } | undefined)?.usage_metadata,
  };
}

function agentFailure(error: unknown, input: RunAgentInput): never {
  if (error instanceof Error && error.message.startsWith("AI_")) {
    throw error;
  }

  logger.warn(
    {
      err: error,
      userId: input.userId,
      conversationId: input.conversationId,
      providerError: classifyProviderError(error),
    },
    "AI agent request failed"
  );
  throw toProviderError(error);
}

export async function runAgent(input: RunAgentInput): Promise<RunAgentResult> {
  const { agent, config, messages, startedAt, pending, resumeDecision } =
    await prepareAgent(input);

  try {
    if (pending) {
      if (resumeDecision === undefined) {
        return interruptResult(input, pending, startedAt, true);
      }

      const result = await agent.invoke(
        new Command({ resume: resumeDecision }),
        config
      );
      const snapshot = await agent.getState(config);
      const waiting = pendingConfirmation(snapshot);
      if (waiting) {
        return interruptResult(input, waiting, startedAt, false);
      }

      return buildAgentResult(input, result.messages as BaseMessage[], startedAt);
    }

    const result = await agent.invoke({ messages }, config);
    const snapshot = await agent.getState(config);
    const waiting = pendingConfirmation(snapshot);
    if (waiting) {
      return interruptResult(input, waiting, startedAt, false);
    }

    return buildAgentResult(input, result.messages as BaseMessage[], startedAt);
  } catch (error) {
    agentFailure(error, input);
  }
}

export async function runAgentStream(
  input: RunAgentInput,
  onToken: (token: string) => void
): Promise<RunAgentResult> {
  const { agent, config, messages, startedAt, pending, resumeDecision } =
    await prepareAgent(input);

  try {
    if (pending && resumeDecision === undefined) {
      const result = interruptResult(input, pending, startedAt, true);
      onToken(result.content);
      return result;
    }

    const resume = pending ? resumeDecision : undefined;
    const stream = await agent.stream(
      resume !== undefined ? new Command({ resume }) : { messages },
      { ...config, streamMode: "messages" }
    );

    for await (const event of stream) {
      const [chunk] = event as [BaseMessageChunk, Record<string, unknown>];
      if (chunk.getType() !== "ai") {
        continue;
      }

      const text = chunk.text;
      if (text) {
        onToken(text);
      }
    }

    const snapshot = await agent.getState(config);
    const waiting = pendingConfirmation(snapshot);
    if (waiting) {
      const result = interruptResult(input, waiting, startedAt, false);
      onToken(result.content);
      return result;
    }

    const resultMessages = (snapshot?.values?.messages ?? []) as BaseMessage[];
    return buildAgentResult(input, resultMessages, startedAt);
  } catch (error) {
    agentFailure(error, input);
  }
}

export function resetAgentCheckpointer(): void {
  checkpointerSetup = null;
}

export async function getAgentCheckpointer(): Promise<PostgresSaver> {
  return getCheckpointer();
}
