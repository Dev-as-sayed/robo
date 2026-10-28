import {
  getRemindersForDeliveries,
  listDueDeliveryRetries,
  recordReminderDelivery,
  type DeliveryReminder,
  type DueReminder,
  type FailedDeliveryRetry,
} from "@robo/shared/reminders";
import logger from "../../lib/logger";
import { sendReminderPush } from "./expo-push";

export interface DeliveryRetryOptions {
  notifyUser: (userId: string, message: DueReminderMessage) => number;
  push?: typeof sendReminderPush;
  record?: typeof recordReminderDelivery;
  list?: typeof listDueDeliveryRetries;
  getReminders?: typeof getRemindersForDeliveries;
}

type DueReminderMessage = Parameters<
  NonNullable<Parameters<typeof import("./notify").createReminderNotifier>[0]["notifyUser"]>
>[1];

/**
 * Retries deliveries recorded as FAILED with a due `nextAttemptAt`. Each attempt is
 * capped by `recordReminderDelivery`, which stops scheduling after the third failure.
 */
export async function retryDueReminderDeliveries(
  now: Date,
  options: DeliveryRetryOptions
): Promise<number> {
  const list = options.list ?? listDueDeliveryRetries;
  const getReminders = options.getReminders ?? getRemindersForDeliveries;
  const push = options.push ?? sendReminderPush;
  const record = options.record ?? recordReminderDelivery;

  const rows = await list(now);
  if (rows.length === 0) {
    return 0;
  }

  const reminders = new Map<string, DeliveryReminder>(
    (await getReminders([...new Set(rows.map((row) => row.reminderId))])).map((row) => [
      row.id,
      row,
    ])
  );

  let retried = 0;

  for (const row of rows) {
    const reminder = reminders.get(row.reminderId);

    if (!reminder) {
      await record({
        reminderId: row.reminderId,
        userId: row.userId,
        dueAt: row.dueAt,
        channel: row.channel,
        status: "FAILED",
        error: "REMINDER_DELETED",
      }).catch((error: unknown) => {
        logger.warn({ err: error, reminderId: row.reminderId }, "delivery retry record failed");
      });
      continue;
    }

    try {
      const sent = await attempt(row, reminder, now, options.notifyUser, push);
      await record({
        reminderId: row.reminderId,
        userId: row.userId,
        dueAt: row.dueAt,
        channel: row.channel,
        status: sent ? "SENT" : "FAILED",
        error: sent ? null : "RETRY_FAILED",
      });
      retried += 1;
    } catch (error) {
      logger.warn(
        { err: error, reminderId: row.reminderId, channel: row.channel },
        "delivery retry failed"
      );
      await record({
        reminderId: row.reminderId,
        userId: row.userId,
        dueAt: row.dueAt,
        channel: row.channel,
        status: "FAILED",
        error: "RETRY_ERROR",
      }).catch(() => undefined);
    }
  }

  return retried;
}

async function attempt(
  row: FailedDeliveryRetry,
  reminder: DeliveryReminder,
  now: Date,
  notifyUser: DeliveryRetryOptions["notifyUser"],
  push: typeof sendReminderPush
): Promise<boolean> {
  if (row.channel === "device") {
    const sockets = notifyUser(reminder.userId, {
      type: "reminder.fire",
      reminderId: reminder.id,
      text: reminder.text,
      dueAt: row.dueAt.toISOString(),
      firedAt: now.toISOString(),
    });

    return sockets > 0;
  }

  const result = await push({
    userId: reminder.userId,
    reminderId: reminder.id,
    text: reminder.text,
    dueAt: row.dueAt,
  });

  return result.sent > 0;
}
