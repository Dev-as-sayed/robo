import { AIMessageChunk } from "@langchain/core/messages";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { streamChatMessage } from "../src/modules/ai/chat-service";
import type { ChatRunnable } from "../src/modules/ai/llm-router";
import type { ChatMessage, ChatRole } from "@robo/shared/chat";

const { appendMessage } = vi.hoisted(() => ({
  appendMessage: vi.fn(
    async (
      _conversationId: string,
      role: ChatRole,
      content: string,
      voiceText?: string | null
    ): Promise<ChatMessage> => ({
      id: `${role}-1`,
      role,
      content,
      voiceText: voiceText ?? null,
      createdAt: new Date(0),
    })
  ),
}));

vi.mock("@robo/shared/users", () => ({
  getMe: vi.fn(async () => ({
    id: "user-1",
    name: "Sam",
    locale: "en",
    timezone: "UTC",
  })),
}));

vi.mock("@robo/shared/chat", () => ({
  getOrCreateConversation: vi.fn(async () => ({
    id: "conversation-1",
    title: "Hello",
    channel: "app",
    createdAt: new Date(0),
    updatedAt: new Date(0),
  })),
  getRecentMessages: vi.fn(async () => []),
  appendMessage,
}));

describe("streaming chat", () => {
  beforeEach(() => {
    appendMessage.mockClear();
  });

  it("streams model tokens and stores the assistant reply", async () => {
    const model = {
      stream: async function* () {
        yield new AIMessageChunk("Hello");
        yield new AIMessageChunk(" world");
      },
    } as unknown as ChatRunnable;
    const tokens: string[] = [];

    const result = await streamChatMessage(
      "user-1",
      { content: "Hi", channel: "app" },
      token => tokens.push(token),
      undefined,
      { model }
    );

    expect(tokens).toEqual(["Hello", " world"]);
    expect(result.assistantMessage.content).toBe("Hello world");
    expect(appendMessage).toHaveBeenLastCalledWith(
      "conversation-1",
      "ASSISTANT",
      "Hello world",
      "Hello world"
    );
  });
});
