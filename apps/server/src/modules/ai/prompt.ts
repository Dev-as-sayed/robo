import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import type { ChatMessage } from "@robo/shared/chat";

export interface ChatUserProfile {
  name: string | null;
  locale: string;
  timezone: string;
}

function formatCurrentTime(timezone: string, now: Date): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: timezone,
    }).format(now);
  } catch {
    return `${now.toISOString()} (UTC)`;
  }
}

export function buildSystemPrompt(user: ChatUserProfile, now = new Date()): string {
  return [
    "You are Robo, a friendly and practical student assistant.",
    "Help the student understand concepts, plan study work, and organize their day.",
    "Answer in the student's language and keep replies focused.",
    "Be concise: lead with the answer, then add only the context that is useful.",
    "Never invent the student's personal data, schedule, documents, or actions.",
    "If you do not have enough information, ask one short clarifying question.",
    "Never claim that you performed an action you did not perform.",
    `Student name: ${user.name ?? "unknown"}.`,
    `Preferred locale: ${user.locale}.`,
    `Student time zone: ${user.timezone}.`,
    `Current date and time for the student: ${formatCurrentTime(user.timezone, now)}.`,
  ].join("\n");
}

export function buildHistoryMessages(history: ChatMessage[]): BaseMessage[] {
  return history.map((message) => {
    if (message.role === "ASSISTANT") {
      return new AIMessage(message.content);
    }

    if (message.role === "SYSTEM" || message.role === "TOOL") {
      return new SystemMessage(message.content);
    }

    return new HumanMessage(message.content);
  });
}

export function extractAssistantText(message: BaseMessage): string {
  const text = message.text.trim();
  if (text) {
    return text;
  }

  if (Array.isArray(message.content)) {
    return message.content
      .map((block) => {
        if (typeof block === "string") {
          return block;
        }
        if (typeof block === "object" && block !== null && "text" in block) {
          const value = (block as { text?: unknown }).text;
          return typeof value === "string" ? value : "";
        }
        return "";
      })
      .join("")
      .trim();
  }

  return "";
}

export function toVoiceText(content: string, maxLength = 320): string {
  const cleaned = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const sentences = cleaned.match(/[^.!?]+[.!?]+/g) ?? [cleaned];
  let voiceText = sentences.slice(0, 2).join(" ").trim() || cleaned;

  if (voiceText.length > maxLength) {
    voiceText = `${voiceText.slice(0, maxLength - 1).trimEnd()}…`;
  }

  return voiceText;
}

export function buildConversationTitle(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  return normalized.length > 80 ? `${normalized.slice(0, 77).trimEnd()}...` : normalized;
}
