import {
  HumanMessage,
  SystemMessage,
  type BaseMessage,
  type BaseMessageChunk,
} from "@langchain/core/messages";
import { RunnableBinding, type RunnableConfig } from "@langchain/core/runnables";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import type { ChatMessage } from "@robo/shared/chat";
import { env } from "../../config/env";
import logger from "../../lib/logger";
import { getChatModels } from "./llm-router";
import { getTraceCallbacks } from "./observability";
import { buildAgentSystemPrompt, buildHistoryMessages, extractAssistantText } from "./prompt";
import { buildTools } from "./tools";
import type { ToolContext } from "./tools/framework";

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
}

export interface RunAgentResult {
  content: string;
  toolCallCount: number;
  model?: string;
  usage?: unknown;
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

function bindToolsWithFallbacks(tools: StructuredToolInterface[]) {
  const models = getChatModels("agent_tools");

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

  const llm = bindToolsWithFallbacks(tools);
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

  return { agent, config, messages, startedAt: Date.now() };
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

  const toolCallCount = resultMessages.reduce((count, message) => {
    if (message.getType() !== "ai") {
      return count;
    }

    const toolCalls = (message as { tool_calls?: unknown[] }).tool_calls;
    return count + (Array.isArray(toolCalls) ? toolCalls.length : 0);
  }, 0);

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
    model: typeof metadata?.model_name === "string" ? metadata.model_name : undefined,
    usage: (lastAiMessage as { usage_metadata?: unknown } | undefined)?.usage_metadata,
  };
}

function agentFailure(error: unknown, input: RunAgentInput): never {
  if (error instanceof Error && error.message.startsWith("AI_")) {
    throw error;
  }

  logger.warn(
    { err: error, userId: input.userId, conversationId: input.conversationId },
    "AI agent request failed"
  );
  throw new Error("AI_PROVIDER_UNAVAILABLE");
}

export async function runAgent(input: RunAgentInput): Promise<RunAgentResult> {
  const { agent, config, messages, startedAt } = await prepareAgent(input);

  try {
    const result = await agent.invoke({ messages }, config);
    return buildAgentResult(input, result.messages as BaseMessage[], startedAt);
  } catch (error) {
    agentFailure(error, input);
  }
}

export async function runAgentStream(
  input: RunAgentInput,
  onToken: (token: string) => void
): Promise<RunAgentResult> {
  const { agent, config, messages, startedAt } = await prepareAgent(input);

  try {
    const stream = await agent.stream(
      { messages },
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
