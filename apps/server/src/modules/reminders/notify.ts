import type { DeviceServerMessage } from "@robo/shared/realtime";
import type { DueReminder } from "@robo/shared/reminders";
import logger from "../../lib/logger";
import type { RealtimeLogger } from "../realtime/gateway";

/** `notifyUser` pushes to the user's connected devices and reports how many took it. */
export interface ReminderNotifierOptions {
  notifyUser: (userId: string, message: DeviceServerMessage) => number;
  logger?: RealtimeLogger;
}

/**
 * Turns a claimed reminder into the channels that actually received it.
 *
 * `device` means a speaker connected to the gateway. `phone` and `push` are recorded on
 * the reminder but need a push sender with credentials that this deployment does not
 * have yet, so they report nothing rather than pretending to deliver. The returned list
 * is what the scheduler logs, so an offline user shows up as `channels: []`.
 */
export function createReminderNotifier(
  options: ReminderNotifierOptions
): (due: DueReminder) => string[] {
  const log = options.logger ?? logger;

  return (due): string[] => {
    const channels: string[] = [];

    if (due.channels.includes("device")) {
      const sockets = options.notifyUser(due.userId, {
        type: "reminder.fire",
        reminderId: due.id,
        text: due.text,
        dueAt: due.dueAt.toISOString(),
        firedAt: due.firedAt.toISOString(),
        ...(due.rrule ? { rrule: due.rrule } : {}),
      });

      if (sockets > 0) {
        channels.push("device");
      }
    }

    const wantsPush = due.channels.includes("phone") || due.channels.includes("push");

    if (wantsPush) {
      log.debug(
        { userId: due.userId, reminderId: due.id, channels: due.channels },
        "push channel skipped: no push sender is configured"
      );
    }

    return channels;
  };
}
