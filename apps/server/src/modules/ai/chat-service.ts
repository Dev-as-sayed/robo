import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import {
  appendMessage,
  getOrCreateConversation,
  getRecentMessages,
  type ChatChannel,
  type ChatMessage,
  type ConversationDetail,
} from "@robo/shared/chat";
import { getMe } from "@robo/shared/users";
import { env } from "../../config/env";
import logger from "../../lib/logger";
import { runAgent, runAgentStream } from "./agent";
import { getChatModels, type ChatRunnable } from "./llm-router";
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

interface ChatTurnContext {
  user: Awaited<ReturnType<typeof getMe>>;
  conversation: Omit<ConversationDetail, "messages">;
  history: ChatMessage[];
  userMessage: ChatMessage;
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

  if (useAgent && getChatModels("agent_tools").length === 0) {
    throw new Error("AI_NOT_CONFIGURED");
  }

  const { user, conversation, history, userMessage } = await beginChat(userId, input);

  const startedAt = Date.now();
  let content: string;
  let toolCallCount = 0;

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
      });

      content = result.content;
      toolCallCount = result.toolCallCount;
    }
  } catch (error) {
    if (!(error instanceof Error && error.message.startsWith("AI_"))) {
      logger.warn(
        {
          err: error,
          userId,
          conversationId: conversation.id,
          task: useAgent ? "agent_tools" : "voice_chat",
        },
        "AI chat request failed"
      );
      throw new Error("AI_PROVIDER_UNAVAILABLE");
    }

    throw error;
  }

  const voiceText = toVoiceText(content);
  const assistantMessage = await appendMessage(
    conversation.id,
    "ASSISTANT",
    content,
    voiceText
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

  if (useAgent && getChatModels("agent_tools").length === 0) {
    throw new Error("AI_NOT_CONFIGURED");
  }

  const { user, conversation, history, userMessage } = await beginChat(userId, input);

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
        },
        emit
      );

      content = result.content;
      toolCallCount = result.toolCallCount;
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
          task: useAgent ? "agent_tools" : "voice_chat",
        },
        "AI chat stream failed"
      );
      throw new Error("AI_PROVIDER_UNAVAILABLE");
    }

    throw error;
  }

  const voiceText = toVoiceText(content);
  const assistantMessage = await appendMessage(
    conversation.id,
    "ASSISTANT",
    content,
    voiceText
  );

  return {
    conversation,
    userMessage,
    assistantMessage,
    toolCallCount,
  };
}
