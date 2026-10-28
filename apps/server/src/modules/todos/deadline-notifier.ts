import { enqueueDeviceEvent } from "@robo/shared/realtime/pending";
import type { ServerDisplayMessage } from "@robo/shared/realtime";
import type { DueTodoDeadline } from "@robo/shared/todos";
import logger from "../../lib/logger";
import type { RealtimeLogger } from "../realtime/gateway";
import { sendReminderPush } from "../reminders/expo-push";

export interface TodoDeadlineNotifierOptions {
  notifyUser: (userId: string, message: ServerDisplayMessage) => number;
  push?: typeof sendReminderPush;
  queue?: typeof enqueueDeviceEvent;
  logger?: RealtimeLogger;
}

export function createTodoDeadlineNotifier(
  options: TodoDeadlineNotifierOptions
): (due: DueTodoDeadline) => Promise<boolean> {
  const log = options.logger ?? logger;
  const push = options.push ?? sendReminderPush;
  const queue = options.queue ?? enqueueDeviceEvent;

  return async (due): Promise<boolean> => {
    const windowLabel = due.window === "24h" ? "24 hours" : "2 hours";
    const message: ServerDisplayMessage = {
      type: "display",
      kind: "text",
      title: "Task due soon",
      body: `${due.title} is due in about ${windowLabel}.`,
      dueAt: due.dueAt.toISOString(),
    };

    let delivered = false;
    const sockets = options.notifyUser(due.userId, message);

    if (sockets > 0) {
      delivered = true;
    } else {
      try {
        await queue(due.userId, message);
        delivered = true;
      } catch (error) {
        log.warn(
          { err: error, userId: due.userId, todoId: due.id },
          "failed to queue deadline warning for offline device"
        );
      }
    }

    const pushResult = await push({
      userId: due.userId,
      reminderId: `todo-deadline:${due.id}:${due.window}`,
      text: `Task due in ${windowLabel}: ${due.title}`,
      dueAt: due.dueAt,
    }).catch((error: unknown) => {
      log.warn({ err: error, userId: due.userId, todoId: due.id }, "deadline push failed");
      return { sent: 0, failed: 1 };
    });

    return delivered || pushResult.sent > 0;
  };
}
