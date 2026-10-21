import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import {
  appendMessage,
  getOrCreateConversation,
  getRecentMessages,
  type ChatChannel,
} from "@robo/shared/chat";
import { getMe } from "@robo/shared/users";
import { env } from "../../config/env";
import logger from "../../lib/logger";
import {
  buildConversationTitle,
  buildHistoryMessages,
  buildSystemPrompt,
  extractAssistantText,
  toVoiceText,
} from "./prompt";
import { getChatModel, type ChatRunnable } from "./llm-router";

export interface SendChatMessageInput {
  content: string;
  conversationId?: string;
  channel: ChatChannel;
}

export interface SendChatMessageDependencies {
  model?: ChatRunnable;
  now?: Date;
}

export async function sendChatMessage(
  userId: string,
  input: SendChatMessageInput,
  dependencies: SendChatMessageDependencies = {}
) {
  const model = dependencies.model ?? getChatModel("voice_chat");
  const user = await getMe(userId);
  const conversation = await getOrCreateConversation(userId, {
    conversationId: input.conversationId,
    channel: input.channel,
    title: buildConversationTitle(input.content),
  });

  const history = await getRecentMessages(conversation.id, env.AI_HISTORY_MESSAGES);
  const userMessage = await appendMessage(conversation.id, "USER", input.content);

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

  const startedAt = Date.now();
  let response;

  try {
    response = await model.invoke(messages);
  } catch (error) {
    logger.warn(
      {
        err: error,
        userId,
        conversationId: conversation.id,
        task: "voice_chat",
      },
      "AI chat request failed"
    );
    throw new Error("AI_PROVIDER_UNAVAILABLE");
  }

  const content = extractAssistantText(response);

  if (!content) {
    throw new Error("AI_EMPTY_RESPONSE");
  }

  const voiceText = toVoiceText(content);
  const assistantMessage = await appendMessage(
    conversation.id,
    "ASSISTANT",
    content,
    voiceText
  );

  const metadata =
    response.response_metadata as Record<string, unknown> | undefined;

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

  return { conversation, userMessage, assistantMessage };
}
