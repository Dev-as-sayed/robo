import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import type { DisplayContent } from "./display";
export * from "./display";

export type ChatChannel = "app" | "device";
export type ChatRole = "USER" | "ASSISTANT" | "SYSTEM" | "TOOL";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  voiceText: string | null;
  displayContent: DisplayContent | null;
  createdAt: Date;
}

export interface ConversationSummary {
  id: string;
  title: string | null;
  channel: ChatChannel;
  createdAt: Date;
  updatedAt: Date;
  lastMessage: ChatMessage | null;
  messageCount: number;
}

export interface ConversationDetail {
  id: string;
  title: string | null;
  channel: ChatChannel;
  createdAt: Date;
  updatedAt: Date;
  messages: ChatMessage[];
}

const messageSelect = {
  id: true,
  role: true,
  content: true,
  voiceText: true,
  displayContent: true,
  createdAt: true,
} as const;

type MessageRow = Prisma.MessageGetPayload<{ select: typeof messageSelect }>;

function toChatMessage(row: MessageRow): ChatMessage {
  return {
    ...row,
    displayContent: (row.displayContent as unknown as DisplayContent | null) ?? null,
  };
}

const conversationSelect = {
  id: true,
  title: true,
  channel: true,
  createdAt: true,
  updatedAt: true,
} as const;

function toPrismaChannel(channel: ChatChannel): "APP" | "DEVICE" {
  return channel === "device" ? "DEVICE" : "APP";
}

function fromPrismaChannel(channel: "APP" | "DEVICE"): ChatChannel {
  return channel === "DEVICE" ? "device" : "app";
}

export async function listConversations(
  userId: string,
  limit = 20
): Promise<ConversationSummary[]> {
  const conversations = await prisma.conversation.findMany({
    where: { userId },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: limit,
    select: {
      ...conversationSelect,
      _count: { select: { messages: true } },
      messages: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 1,
        select: messageSelect,
      },
    },
  });

  return conversations.map((conversation) => ({
    id: conversation.id,
    title: conversation.title,
    channel: fromPrismaChannel(conversation.channel),
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    lastMessage: conversation.messages[0]
      ? toChatMessage(conversation.messages[0])
      : null,
    messageCount: conversation._count.messages,
  }));
}

export async function getConversation(
  userId: string,
  conversationId: string,
  limit = 50
): Promise<ConversationDetail> {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId },
    select: conversationSelect,
  });

  if (!conversation) {
    throw new Error("CONVERSATION_NOT_FOUND");
  }

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    select: messageSelect,
  });

  return {
    id: conversation.id,
    title: conversation.title,
    channel: fromPrismaChannel(conversation.channel),
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    messages: messages.reverse().map(toChatMessage),
  };
}

export async function getOrCreateConversation(
  userId: string,
  input: { conversationId?: string; channel: ChatChannel; title?: string }
): Promise<Omit<ConversationDetail, "messages">> {
  if (input.conversationId) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: input.conversationId, userId },
      select: conversationSelect,
    });

    if (!conversation) {
      throw new Error("CONVERSATION_NOT_FOUND");
    }

    return {
      id: conversation.id,
      title: conversation.title,
      channel: fromPrismaChannel(conversation.channel),
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }

  const conversation = await prisma.conversation.create({
    data: {
      userId,
      channel: toPrismaChannel(input.channel),
      title: input.title?.slice(0, 120) ?? null,
    },
    select: conversationSelect,
  });

  return {
    id: conversation.id,
    title: conversation.title,
    channel: fromPrismaChannel(conversation.channel),
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}

export async function appendMessage(
  conversationId: string,
  role: ChatRole,
  content: string,
  voiceText?: string | null,
  displayContent?: DisplayContent | null
): Promise<ChatMessage> {
  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId,
        role,
        content,
        voiceText: voiceText ?? null,
        displayContent:
          displayContent === null || displayContent === undefined
            ? Prisma.JsonNull
            : (displayContent as unknown as Prisma.InputJsonValue),
      },
      select: messageSelect,
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    }),
  ]);

  return toChatMessage(message);
}

export async function getRecentMessages(
  conversationId: string,
  limit: number
): Promise<ChatMessage[]> {
  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    select: messageSelect,
  });

  return messages.reverse().map(toChatMessage);
}
