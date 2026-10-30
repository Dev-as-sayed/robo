import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { ensurePermissionWithExplanation, notificationPermission } from "@/permissions";

let registered = false;
let registeredTokenId: string | null = null;
let registrationEpoch = 0;

export type NotificationRoute =
  | "/tasks"
  | "/reminders"
  | "/schedule"
  | "/exams"
  | "/study"
  | "/insights"
  | "/class-notes"
  | "/approvals";

export function notificationRoute(data: unknown): NotificationRoute | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const payload = data as Record<string, unknown>;
  const kind = typeof payload.kind === "string" ? payload.kind : null;

  if (kind === "class_note") {
    return "/class-notes";
  }
  if (kind === "pending_action") {
    return "/approvals";
  }
  if (kind === "nudge") {
    switch (payload.nudgeType) {
      case "TASK":
        return "/tasks";
      case "EXAM":
        return "/exams";
      case "STUDY":
        return "/study";
      case "REMINDER":
        return "/reminders";
      default:
        return "/insights";
    }
  }

  const reminderId = typeof payload.reminderId === "string" ? payload.reminderId : null;
  if (reminderId?.startsWith("todo-deadline:")) {
    return "/tasks";
  }
  if (reminderId?.startsWith("class:")) {
    return "/schedule";
  }
  if (reminderId || kind === "local_reminder") {
    return "/reminders";
  }

  return null;
}

export function hasPushRegistration(): boolean {
  return registered;
}

export async function clearPushRegistration(): Promise<string | null> {
  registrationEpoch += 1;
  const id = registeredTokenId;
  registered = false;
  registeredTokenId = null;
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);
  return id;
}

/** True when the platform cannot register for Expo push (web/simulator/no project id). */
export function shouldUseLocalFallback(): boolean {
  return !registered;
}

export interface LocalReminder {
  id: string;
  text: string;
  status: string;
  nextAt: string | null;
}

/**
 * Local notifications are a fallback for builds without Expo push. They are only
 * scheduled when push registration did not succeed, so users do not get duplicates.
 */
export async function syncLocalReminderNotifications(
  reminders: readonly LocalReminder[],
): Promise<number> {
  if (Platform.OS === "web" || registered) {
    return 0;
  }

  const allowed = await ensurePermissionWithExplanation({
    title: "Reminder notifications",
    message: "Robo can alert you when a reminder is due, even when the app is closed.",
    api: notificationPermission,
  });
  if (!allowed) {
    return 0;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Reminders",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  await Notifications.cancelAllScheduledNotificationsAsync();

  const now = Date.now();
  let scheduled = 0;

  for (const reminder of reminders) {
    if (registered) {
      await Notifications.cancelAllScheduledNotificationsAsync();
      return 0;
    }
    if (reminder.status !== "active" || !reminder.nextAt) continue;
    const at = new Date(reminder.nextAt);
    if (Number.isNaN(at.getTime()) || at.getTime() <= now) continue;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Robo reminder",
        body: reminder.text,
        data: { reminderId: reminder.id, kind: "local_reminder" },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: at,
      },
    });
    scheduled += 1;
  }

  if (registered) {
    await Notifications.cancelAllScheduledNotificationsAsync();
    return 0;
  }

  return scheduled;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function projectId(): string | undefined {
  const eas = Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined;
  const easConfig = (Constants as { easConfig?: { projectId?: string } }).easConfig;
  return eas?.projectId ?? easConfig?.projectId;
}

/**
 * Requests permission and stores the Expo push token. Returns false in Expo Go,
 * simulators, or a build without an EAS project id instead of throwing.
 */
export async function registerForPushNotifications(
  register: (input: { token: string; platform: "ios" | "android" }) => Promise<{ id: string }>,
): Promise<boolean> {
  if (registered || Platform.OS === "web" || !Device.isDevice) {
    return false;
  }

  const epoch = registrationEpoch;
  const id = projectId();
  if (!id) {
    return false;
  }

  const allowed = await ensurePermissionWithExplanation({
    title: "Push notifications",
    message:
      "Robo sends confirmations, class alerts and reminders to this phone. You can change this later in Settings.",
    api: notificationPermission,
  });
  if (!allowed) {
    return false;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Reminders",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
  const pushToken = await register({
    token,
    platform: Platform.OS === "ios" ? "ios" : "android",
  });
  if (epoch !== registrationEpoch) {
    return false;
  }
  registeredTokenId = pushToken.id;
  registered = true;
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);
  return true;
}
