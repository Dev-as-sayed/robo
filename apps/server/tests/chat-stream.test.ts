import { AIMessageChunk } from "@langchain/core/messages";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { streamChatMessage } from "../src/modules/ai/chat-service";
import type { ChatRunnable } from "../src/modules/ai/llm-router";
import type { ChatMessage, ChatRole } from "@robo/shared/chat";
import { recordAiTokenUsage } from "@robo/shared/ai-usage";

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
      displayContent: null,
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
  buildDisplayContent: vi.fn((content: string) => ({
    version: 1,
    title: null,
    blocks: [{ type: "text", text: content }],
  })),
}));

vi.mock("@robo/shared/documents", () => ({
  countDocuments: vi.fn(async () => 0),
}));

vi.mock("@robo/shared/ai-usage", () => ({
  consumeAiQuota: vi.fn(async () => ({
    allowed: true,
    used: 1,
    limit: 200,
    remaining: 199,
  })),
  recordAiTokenUsage: vi.fn(async () => undefined),
}));

vi.mock("@robo/shared/action-logs", () => ({
  getActionLogsForConversationSince: vi.fn(async () => []),
}));

describe("streaming chat", () => {
  beforeEach(() => {
    appendMessage.mockClear();
    vi.mocked(recordAiTokenUsage).mockClear();
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
      "Hello world",
      {
        version: 1,
        title: null,
        blocks: [{ type: "text", text: "Hello world" }],
      }
    );
    expect(recordAiTokenUsage).toHaveBeenCalledTimes(1);
  });
});
