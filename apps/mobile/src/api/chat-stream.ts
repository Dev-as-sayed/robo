import { getTokens } from "@/auth/tokens";
import { API_URL } from "@/config";
import type { ChatTurnResult } from "@/types";
import { refreshOnce } from "./base-query";
import { type SseFrame, splitSseFrames } from "./sse";

const STREAM_URL = `${API_URL}/chat/messages/stream`;

export interface ChatStreamInput {
  content: string;
  conversationId?: string;
}

export interface ChatStreamHandlers {
  onToken: (token: string) => void;
  onDone: (result: ChatTurnResult) => void;
  onError: (message: string) => void;
}

export type ChatStreamHandle = () => void;

function describeFailure(raw: string, status: number): string {
  try {
    const payload = JSON.parse(raw) as { message?: unknown; code?: unknown };
    if (typeof payload.message === "string" && payload.message.length > 0) {
      return payload.message;
    }
    if (typeof payload.code === "string" && payload.code.length > 0) {
      return payload.code;
    }
  } catch {
    // Bodies that are not JSON fall through to the status message.
  }

  return `Robo could not answer (HTTP ${status}).`;
}

export async function startChatStream(
  input: ChatStreamInput,
  handlers: ChatStreamHandlers
): Promise<ChatStreamHandle> {
  const tokens = await getTokens();

  if (!tokens) {
    handlers.onError("You are signed out. Sign in to chat.");
    return () => {};
  }

  let cancelled = false;
  let settled = false;
  let refreshTokenTried = false;
  let buffer = "";
  let consumed = 0;
  let activeXhr: XMLHttpRequest | null = null;

  const fail = (message: string): void => {
    if (cancelled || settled) {
      return;
    }
    settled = true;
    handlers.onError(message);
  };

  const handleFrame = (frame: SseFrame): void => {
    let payload: unknown;

    try {
      payload = JSON.parse(frame.data);
    } catch {
      fail("Robo sent an unexpected response.");
      return;
    }

    if (frame.event === "token") {
      const token = (payload as { token?: unknown }).token;
      if (typeof token === "string") {
        handlers.onToken(token);
      }
      return;
    }

    if (frame.event === "done") {
      if (!cancelled && !settled) {
        settled = true;
        handlers.onDone(payload as ChatTurnResult);
      }
      return;
    }

    if (frame.event === "error") {
      const { message, code } = payload as {
        message?: unknown;
        code?: unknown;
      };
      fail(
        typeof message === "string" && message.length > 0
          ? message
          : typeof code === "string"
            ? code
            : "Robo could not finish the answer."
      );
    }
  };

  const open = (accessToken: string): void => {
    const xhr = new XMLHttpRequest();
    activeXhr = xhr;
    buffer = "";
    consumed = 0;

    xhr.open("POST", STREAM_URL);
    xhr.setRequestHeader("content-type", "application/json");
    xhr.setRequestHeader("authorization", `Bearer ${accessToken}`);

    const drain = (): void => {
      if (xhr.responseText.length === consumed) {
        return;
      }
      buffer += xhr.responseText.slice(consumed);
      consumed = xhr.responseText.length;

      const { frames, rest } = splitSseFrames(buffer);
      buffer = rest;

      for (const frame of frames) {
        handleFrame(frame);
      }
    };

    xhr.onprogress = drain;

    xhr.onload = () => {
      drain();

      if (cancelled || settled) {
        return;
      }

      if (xhr.status === 401 && !refreshTokenTried) {
        refreshTokenTried = true;

        void (async () => {
          const refreshed = await refreshOnce();
          const next = refreshed ? await getTokens() : null;

          if (cancelled) {
            return;
          }

          if (next) {
            open(next.accessToken);
          } else {
            fail("Your session expired. Sign in again.");
          }
        })();

        return;
      }

      if (xhr.status < 200 || xhr.status >= 300) {
        fail(describeFailure(xhr.responseText, xhr.status));
        return;
      }

      fail("Robo closed the conversation early.");
    };

    xhr.onerror = () => fail("Cannot reach the Robo server.");
    xhr.ontimeout = () => fail("Robo took too long to answer.");

    xhr.send(
      JSON.stringify({
        content: input.content,
        channel: "app",
        ...(input.conversationId
          ? { conversationId: input.conversationId }
          : {}),
      })
    );
  };

  open(tokens.accessToken);

  return () => {
    cancelled = true;
    activeXhr?.abort();
  };
}
