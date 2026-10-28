import { listPushTokenStrings, revokePushTokenById } from "@robo/shared/users";
import logger from "../../lib/logger";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_BATCH_SIZE = 100;

interface ExpoTicket {
  status?: string;
  message?: string;
  details?: { error?: string };
}

interface ExpoResponse {
  data?: ExpoTicket[];
}

export interface PushReminder {
  userId: string;
  reminderId: string;
  text: string;
  dueAt: Date;
}

export interface PushResult {
  sent: number;
  failed: number;
}

export interface PushMessage {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Sends one push message to every registered Expo token. Tickets that Expo marks as
 * `DeviceNotRegistered` are deleted so a reinstall does not leave a dead row forever.
 */
export async function sendPushToUser(
  message: PushMessage,
  fetchImpl: typeof fetch = fetch
): Promise<PushResult> {
  const tokens = await listPushTokenStrings(message.userId);
  if (tokens.length === 0) {
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (let offset = 0; offset < tokens.length; offset += EXPO_BATCH_SIZE) {
    const batch = tokens.slice(offset, offset + EXPO_BATCH_SIZE);
    const messages = batch.map(token => ({
      to: token,
      title: message.title,
      body: message.body,
      sound: "default",
      data: message.data ?? {},
    }));

    try {
      const response = await fetchImpl(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(process.env.EXPO_ACCESS_TOKEN
            ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
            : {}),
        },
        body: JSON.stringify(messages),
        signal: AbortSignal.timeout(5_000),
      });

      if (!response.ok) {
        failed += batch.length;
        logger.warn(
          { userId: message.userId, status: response.status },
          "expo push request failed"
        );
        continue;
      }

      const payload = (await response.json()) as ExpoResponse;
      const tickets = Array.isArray(payload.data) ? payload.data : [];

      for (let index = 0; index < batch.length; index += 1) {
        const ticket = tickets[index];
        if (ticket?.status === "ok") {
          sent += 1;
          continue;
        }

        failed += 1;
        if (ticket?.details?.error === "DeviceNotRegistered") {
          await revokePushTokenById(message.userId, batch[index]).catch(() => undefined);
        }
      }
    } catch (error) {
      failed += batch.length;
      logger.warn(
        { err: error, userId: message.userId },
        "expo push request threw"
      );
    }
  }

  return { sent, failed };
}

/**
 * Sends one reminder to every registered Expo token. Tickets that Expo marks as
 * `DeviceNotRegistered` are deleted so a reinstall does not leave a dead row forever.
 */
export async function sendReminderPush(
  reminder: PushReminder,
  fetchImpl: typeof fetch = fetch
): Promise<PushResult> {
  return sendPushToUser(
    {
      userId: reminder.userId,
      title: "Reminder",
      body: reminder.text,
      data: {
        reminderId: reminder.reminderId,
        dueAt: reminder.dueAt.toISOString(),
      },
    },
    fetchImpl
  );
}
