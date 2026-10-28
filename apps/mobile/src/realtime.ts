import type { PendingActionKind, PendingActionStatus } from "@/types";
import { getTokens } from "@/auth/tokens";
import { refreshOnce } from "@/api/base-query";
import { API_URL } from "@/config";

export interface AppActionEvent {
  type: "action.confirm.request" | "action.execute";
  action: {
    id: string;
    kind: PendingActionKind;
    recipientName: string;
    status: PendingActionStatus;
    expiresAt: string;
    uri?: string;
  };
}

function socketUrl(token: string): string {
  const url = new URL(API_URL);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws/app";
  url.search = `?token=${encodeURIComponent(token)}`;
  return url.toString();
}

function parseEvent(value: unknown): AppActionEvent | null {
  if (!value || typeof value !== "object") return null;
  const event = value as Partial<AppActionEvent>;
  if (
    event.type !== "action.confirm.request" &&
    event.type !== "action.execute"
  ) {
    return null;
  }
  if (!event.action || typeof event.action.id !== "string") return null;
  return event as AppActionEvent;
}

/**
 * Keeps one app WebSocket for foreground action events. Reconnects with capped
 * backoff, refreshes the access token once on an auth close, and returns a cleanup
 * function so signing out or unmounting cannot leave a zombie socket.
 */
export function connectAppRealtime(
  onEvent: (event: AppActionEvent) => void
): () => void {
  let closed = false;
  let socket: WebSocket | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;

  const schedule = () => {
    if (closed) return;
    const delay = Math.min(30_000, 1_000 * 2 ** attempt);
    attempt += 1;
    retry = setTimeout(() => {
      retry = null;
      void open();
    }, delay);
  };

  const open = async (): Promise<void> => {
    if (closed) return;
    const tokens = await getTokens();
    if (!tokens || closed) return;

    try {
      socket = new WebSocket(socketUrl(tokens.accessToken));
    } catch {
      schedule();
      return;
    }

    socket.onopen = () => {
      attempt = 0;
    };

    socket.onmessage = message => {
      try {
        const event = parseEvent(JSON.parse(String(message.data)));
        if (event) onEvent(event);
      } catch {
        // Ignore malformed frames; the next valid event still works.
      }
    };

    socket.onclose = event => {
      socket = null;
      if (closed) return;

      if (event.code === 4001) {
        void refreshOnce().then(refreshed => {
          if (closed) return;
          if (refreshed) {
            void open();
          } else {
            schedule();
          }
        });
        return;
      }

      schedule();
    };

    socket.onerror = () => {
      socket?.close();
    };
  };

  void open();

  return () => {
    closed = true;
    if (retry) clearTimeout(retry);
    retry = null;
    socket?.close();
    socket = null;
  };
}
