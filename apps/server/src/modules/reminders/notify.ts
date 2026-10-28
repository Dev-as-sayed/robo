import type { DeviceServerMessage } from "@robo/shared/realtime";
import {
  recordReminderDelivery,
  type DueReminder,
  type ReminderDeliveryChannel,
  type ReminderDeliveryStatus,
} from "@robo/shared/reminders";
import { enqueueDeviceEvent } from "@robo/shared/realtime/pending";
import logger from "../../lib/logger";
import type { RealtimeLogger } from "../realtime/gateway";
import { sendReminderPush } from "./expo-push";

/** `notifyUser` pushes to the user's connected devices and reports how many took it. */
export interface ReminderNotifierOptions {
  notifyUser: (userId: string, message: DeviceServerMessage) => number;
  push?: typeof sendReminderPush;
  record?: typeof recordReminderDelivery;
  queue?: typeof enqueueDeviceEvent;
  logger?: RealtimeLogger;
}

/**
 * Turns a claimed reminder into the channels that actually received it.
 *
 * `device` means a speaker connected to the gateway. `phone` and `push` go through
 * Expo when at least one token is registered. The returned list is what the scheduler
 * logs, so an offline user with no push tokens shows up as `channels: []`.
 */
export function createReminderNotifier(
  options: ReminderNotifierOptions
): (due: DueReminder) => Promise<string[]> {
  const log = options.logger ?? logger;
  const push = options.push ?? sendReminderPush;
  const record = options.record ?? recordReminderDelivery;
  const queue = options.queue ?? enqueueDeviceEvent;

  const persist = async (
    due: DueReminder,
    channel: ReminderDeliveryChannel,
    status: ReminderDeliveryStatus,
    error?: string | null
  ): Promise<void> => {
    try {
      await record({
        reminderId: due.id,
        userId: due.userId,
        dueAt: due.dueAt,
        channel,
        status,
        error,
      });
    } catch (recordError) {
      log.warn(
        { err: recordError, userId: due.userId, reminderId: due.id, channel },
        "failed to persist reminder delivery"
      );
    }
  };

  return async (due): Promise<string[]> => {
    const channels: string[] = [];

    if (due.channels.includes("device")) {
      const message = {
        type: "reminder.fire" as const,
        reminderId: due.id,
        text: due.text,
        dueAt: due.dueAt.toISOString(),
        firedAt: due.firedAt.toISOString(),
        ...(due.rrule ? { rrule: due.rrule } : {}),
      };
      const sockets = options.notifyUser(due.userId, message);

      if (sockets > 0) {
        channels.push("device");
        await persist(due, "device", "SENT");
      } else {
        try {
          await queue(due.userId, message);
          await persist(due, "device", "PENDING", "QUEUED_FOR_RECONNECT");
        } catch (queueError) {
          log.warn(
            { err: queueError, userId: due.userId, reminderId: due.id },
            "failed to queue reminder for offline device"
          );
          await persist(due, "device", "FAILED", "NO_DEVICE_CONNECTED");
        }
      }
    }

    const wantsPush = due.channels.includes("phone") || due.channels.includes("push");

    if (wantsPush) {
      const result = await push({
        userId: due.userId,
        reminderId: due.id,
        text: due.text,
        dueAt: due.dueAt,
      });

      if (result.sent > 0) {
        channels.push("push");
        await persist(due, "push", "SENT");
      } else {
        await persist(
          due,
          "push",
          "FAILED",
          result.failed > 0 ? "PUSH_REJECTED" : "NO_PUSH_TOKEN"
        );
      }

      if (result.failed > 0) {
        log.warn(
          { userId: due.userId, reminderId: due.id, failed: result.failed },
          "some push notifications failed"
        );
      }
    }

    return channels;
  };
}
