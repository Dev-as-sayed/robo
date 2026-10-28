import type { PendingAction } from "@robo/shared/pending-actions";
import logger from "../../lib/logger";
import { sendPushToUser } from "../reminders/expo-push";

export type AppActionEventType = "action.confirm.request" | "action.execute";

export interface AppActionEvent {
  type: AppActionEventType;
  action: {
    id: string;
    kind: PendingAction["kind"];
    recipientName: string;
    status: PendingAction["status"];
    expiresAt: string;
    uri?: string;
  };
}

export type AppEventNotifier = (userId: string, event: AppActionEvent) => number;

let notifier: AppEventNotifier | null = null;

export function setAppEventNotifier(next: AppEventNotifier | null): void {
  notifier = next;
}

function actionEvent(
  type: AppActionEventType,
  action: PendingAction & { uri?: string }
): AppActionEvent {
  return {
    type,
    action: {
      id: action.id,
      kind: action.kind,
      recipientName: action.recipientName,
      status: action.status,
      expiresAt: action.expiresAt.toISOString(),
      ...(action.uri ? { uri: action.uri } : {}),
    },
  };
}

function pushCopy(event: AppActionEvent): { title: string; body: string } {
  const verb =
    event.action.kind === "CALL"
      ? "call"
      : event.action.kind === "EMAIL"
        ? "email"
        : event.action.kind === "WHATSAPP"
          ? "message on WhatsApp"
          : "text";

  if (event.type === "action.confirm.request") {
    return {
      title: "Confirm with Robo",
      body: `Ready to ${verb} ${event.action.recipientName}. Tap to review.`,
    };
  }

  return {
    title: "Ready on your phone",
    body: `${event.action.recipientName} is ready. Tap to open the action.`,
  };
}

/**
 * Sends the event to the app WebSocket and, for backgrounded phones, Expo push.
 * Push failures never block the AI turn or the REST confirmation.
 */
export function publishAppActionEvent(
  userId: string,
  type: AppActionEventType,
  action: PendingAction & { uri?: string }
): AppActionEvent {
  const event = actionEvent(type, action);

  try {
    notifier?.(userId, event);
  } catch (error) {
    logger.warn({ err: error, userId }, "failed to deliver app realtime event");
  }

  const copy = pushCopy(event);
  void sendPushToUser({
    userId,
    title: copy.title,
    body: copy.body,
    data: {
      kind: "pending_action",
      event: event.type,
      actionId: event.action.id,
    },
  }).catch((error: unknown) => {
    logger.warn({ err: error, userId }, "failed to send pending-action push");
  });

  return event;
}
