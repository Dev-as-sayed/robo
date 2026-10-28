import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import {
  appendMessage,
  buildDisplayContent,
  getOrCreateConversation,
  getRecentMessages,
  type ChatChannel,
  type ChatMessage,
  type ConversationDetail,
  type DisplayContent,
} from "@robo/shared/chat";
import { getActionLogsForConversationSince } from "@robo/shared/action-logs";
import { countDocuments } from "@robo/shared/documents";
import type { AiTokenUsage } from "@robo/shared/ai-usage";
import { getMe } from "@robo/shared/users";
import { env } from "../../config/env";
import logger from "../../lib/logger";
import { runAgent, runAgentStream } from "./agent";
import { getChatModels, type ChatRunnable, type ChatTask } from "./llm-router";
import { toProviderError } from "./provider-errors";
import { recordUsage, reserveQuota } from "./usage-guard";
import {
  buildConversationTitle,
  buildHistoryMessages,
  buildSystemPrompt,
  extractAssistantText,
  toVoiceText,
} from "./prompt";

export interface SendChatMessageInput {
  content: string;
  conversationId?: string;
  channel: ChatChannel;
}

export interface SendChatMessageDependencies {
  model?: ChatRunnable;
  now?: Date;
}

export interface ChatTurnResult {
  conversation: Omit<ConversationDetail, "messages">;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  toolCallCount: number;
}

export async function chatTaskForUser(
  userId: string,
  cloudAiForDocs: boolean
): Promise<ChatTask> {
  if (cloudAiForDocs) {
    return "agent_tools";
  }

  try {
    const count = await countDocuments(userId);
    return count > 0 ? "private_docs" : "agent_tools";
  } catch (error) {
    logger.warn(
      { err: error, userId },
      "could not count documents; keeping chat private"
    );
    return "private_docs";
  }
}

function assertTaskConfigured(task: ChatTask): void {
  if (task === "private_docs" && getChatModels(task).length === 0) {
    throw new Error("AI_LOCAL_NOT_CONFIGURED");
  }
}

interface ChatTurnContext {
  user: Awaited<ReturnType<typeof getMe>>;
  conversation: Omit<ConversationDetail, "messages">;
  history: ChatMessage[];
  userMessage: ChatMessage;
}

async function displayContentForTurn(
  userId: string,
  conversationId: string,
  content: string,
  startedAt: number
): Promise<DisplayContent> {
  try {
    const actions = await getActionLogsForConversationSince(
      userId,
      conversationId,
      new Date(startedAt - 1_000)
    );

    return buildDisplayContent(
      content,
      actions.map((action) => ({ toolName: action.toolName, output: action.output }))
    );
  } catch (error) {
    logger.warn({ err: error, userId, conversationId }, "failed to build display content");
    return buildDisplayContent(content);
  }
}

async function beginChat(
  userId: string,
  input: SendChatMessageInput
): Promise<ChatTurnContext> {
  const user = await getMe(userId);
  const conversation = await getOrCreateConversation(userId, {
    conversationId: input.conversationId,
    channel: input.channel,
    title: buildConversationTitle(input.content),
  });

  const history = await getRecentMessages(conversation.id, env.AI_HISTORY_MESSAGES);
  const userMessage = await appendMessage(conversation.id, "USER", input.content);

  return { user, conversation, history, userMessage };
}

export async function sendChatMessage(
  userId: string,
  input: SendChatMessageInput,
  dependencies: SendChatMessageDependencies = {}
): Promise<ChatTurnResult> {
  const useAgent = !dependencies.model;

  await reserveQuota(userId);
  const { user, conversation, history, userMessage } = await beginChat(userId, input);
  const task = useAgent
    ? await chatTaskForUser(userId, user.cloudAiForDocs)
    : "voice_chat";

  if (useAgent) {
    assertTaskConfigured(task);
  }

  const startedAt = Date.now();
  let content: string;
  let toolCallCount = 0;
  let usage: AiTokenUsage | null = null;

  try {
    if (dependencies.model) {
      const model = dependencies.model;
      const messages = [
        new SystemMessage(
          buildSystemPrompt(
            { name: user.name, locale: user.locale, timezone: user.timezone },
            dependencies.now
          )
        ),
        ...buildHistoryMessages(history),
        new HumanMessage(input.content),
      ];

      const response = await model.invoke(messages);
      content = extractAssistantText(response);
      if (!content) {
        throw new Error("AI_EMPTY_RESPONSE");
      }

      const metadata = response.response_metadata as
        | Record<string, unknown>
        | undefined;
      usage = (response.usage_metadata as AiTokenUsage | undefined) ?? null;

      logger.info(
        {
          userId,
          conversationId: conversation.id,
          task: "voice_chat",
          latencyMs: Date.now() - startedAt,
          model: typeof metadata?.model_name === "string" ? metadata.model_name : undefined,
          usage: response.usage_metadata,
        },
        "AI chat response generated"
      );
    } else {
      const result = await runAgent({
        userId,
        conversationId: conversation.id,
        content: input.content,
        history,
        user: {
          name: user.name,
          locale: user.locale,
          timezone: user.timezone,
        },
        now: dependencies.now,
        task,
        confirmationText: input.content,
      });

      content = result.content;
      toolCallCount = result.toolCallCount;
      usage = (result.usage as AiTokenUsage | undefined) ?? null;
    }
  } catch (error) {
    if (!(error instanceof Error && error.message.startsWith("AI_"))) {
      logger.warn(
        {
          err: error,
          userId,
          conversationId: conversation.id,
          task,
        },
        "AI chat request failed"
      );
      throw toProviderError(error);
    }

    throw error;
  }

  recordUsage(userId, usage);
  const voiceText = toVoiceText(content);
  const assistantMessage = await appendMessage(
    conversation.id,
    "ASSISTANT",
    content,
    voiceText,
    await displayContentForTurn(userId, conversation.id, content, startedAt)
  );

  return {
    conversation,
    userMessage,
    assistantMessage,
    toolCallCount,
  };
}

export async function streamChatMessage(
  userId: string,
  input: SendChatMessageInput,
  onToken: (token: string) => void,
  abortSignal?: AbortSignal,
  dependencies: SendChatMessageDependencies = {}
): Promise<ChatTurnResult> {
  const useAgent = !dependencies.model;

  await reserveQuota(userId);
  const { user, conversation, history, userMessage } = await beginChat(userId, input);
  const task = useAgent
    ? await chatTaskForUser(userId, user.cloudAiForDocs)
    : "voice_chat";

  if (useAgent) {
    assertTaskConfigured(task);
  }

  const startedAt = Date.now();
  let firstTokenMs = 0;
  const emit = (token: string): void => {
    if (firstTokenMs === 0) {
      firstTokenMs = Date.now() - startedAt;
    }
    onToken(token);
  };

  let content: string;
  let toolCallCount = 0;
  let usage: AiTokenUsage | null = null;

  try {
    if (dependencies.model) {
      const messages = [
        new SystemMessage(
          buildSystemPrompt(
            { name: user.name, locale: user.locale, timezone: user.timezone },
            dependencies.now
          )
        ),
        ...buildHistoryMessages(history),
        new HumanMessage(input.content),
      ];

      let streamed = "";
      const stream = await dependencies.model.stream(
        messages,
        abortSignal ? { signal: abortSignal } : undefined
      );

      for await (const chunk of stream) {
        const chunkUsage = (chunk as { usage_metadata?: AiTokenUsage })
          .usage_metadata;
        if (chunkUsage) {
          usage = chunkUsage;
        }

        const text = chunk.text;
        if (text) {
          streamed += text;
          emit(text);
        }
      }

      content = streamed.trim();
      if (!content) {
        throw new Error("AI_EMPTY_RESPONSE");
      }

      logger.info(
        {
          userId,
          conversationId: conversation.id,
          task: "voice_chat",
          latencyMs: Date.now() - startedAt,
          firstTokenMs,
          streaming: true,
        },
        "AI chat response streamed"
      );
    } else {
      const result = await runAgentStream(
        {
          userId,
          conversationId: conversation.id,
          content: input.content,
          history,
          user: {
            name: user.name,
            locale: user.locale,
            timezone: user.timezone,
          },
          now: dependencies.now,
          signal: abortSignal,
          task,
          confirmationText: input.content,
        },
        emit
      );

      content = result.content;
      toolCallCount = result.toolCallCount;
      usage = (result.usage as AiTokenUsage | undefined) ?? null;
    }
  } catch (error) {
    if (abortSignal?.aborted) {
      throw error;
    }

    if (!(error instanceof Error && error.message.startsWith("AI_"))) {
      logger.warn(
        {
          err: error,
          userId,
          conversationId: conversation.id,
          task,
        },
        "AI chat stream failed"
      );
      throw new Error("AI_PROVIDER_UNAVAILABLE");
    }

    throw error;
  }

  recordUsage(userId, usage);
  const voiceText = toVoiceText(content);
  const assistantMessage = await appendMessage(
    conversation.id,
    "ASSISTANT",
    content,
    voiceText,
    await displayContentForTurn(userId, conversation.id, content, startedAt)
  );

  return {
    conversation,
    userMessage,
    assistantMessage,
    toolCallCount,
  };
}
