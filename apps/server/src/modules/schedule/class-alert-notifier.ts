import { enqueueDeviceEvent } from "@robo/shared/realtime/pending";
import type { ServerClassAlertMessage } from "@robo/shared/realtime";
import type { DueClass } from "@robo/shared/schedule";
import type { RealtimeLogger } from "../realtime/gateway";
import { sendReminderPush } from "../reminders/expo-push";
import logger from "../../lib/logger";

export interface ClassAlertNotifierOptions {
  notifyUser: (userId: string, message: ServerClassAlertMessage) => number;
  push?: typeof sendReminderPush;
  queue?: typeof enqueueDeviceEvent;
  logger?: RealtimeLogger;
}

export function createClassAlertNotifier(
  options: ClassAlertNotifierOptions
): (due: DueClass) => Promise<boolean> {
  const log = options.logger ?? logger;
  const push = options.push ?? sendReminderPush;
  const queue = options.queue ?? enqueueDeviceEvent;

  return async (due): Promise<boolean> => {
    const minutesUntil = Math.max(
      0,
      Math.round((due.startsAt.getTime() - due.firedAt.getTime()) / 60_000)
    );
    const message = {
      type: "class.alert" as const,
      scheduleId: due.id,
      title: due.title,
      startsAt: due.startsAt.toISOString(),
      minutesUntil,
      ...(due.room ? { room: due.room } : {}),
      ...(due.subject ? { subject: due.subject } : {}),
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
          { err: error, userId: due.userId, scheduleId: due.id },
          "failed to queue class alert for offline device"
        );
      }
    }

    const pushText =
      minutesUntil > 0
        ? `${due.title} starts in ${minutesUntil} min`
        : `${due.title} starts now`;
    const pushResult = await push({
      userId: due.userId,
      reminderId: `class:${due.id}`,
      text: pushText,
      dueAt: due.dueAt,
    }).catch((error: unknown) => {
      log.warn({ err: error, userId: due.userId, scheduleId: due.id }, "class alert push failed");
      return { sent: 0, failed: 1 };
    });

    return delivered || pushResult.sent > 0;
  };
}
