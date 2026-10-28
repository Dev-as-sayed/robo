import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import {
  ensurePermissionWithExplanation,
  notificationPermission,
} from "@/permissions";

let registered = false;

export function hasPushRegistration(): boolean {
  return registered;
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
  reminders: readonly LocalReminder[]
): Promise<number> {
  if (Platform.OS === "web" || registered) {
    return 0;
  }

  const allowed = await ensurePermissionWithExplanation({
    title: "Reminder notifications",
    message:
      "Robo can alert you when a reminder is due, even when the app is closed.",
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
      trigger: at,
    });
    scheduled += 1;
  }

  return scheduled;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
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
  register: (input: { token: string; platform: "ios" | "android" }) => Promise<unknown>
): Promise<boolean> {
  if (registered || Platform.OS === "web" || !Device.isDevice) {
    return false;
  }

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
  await register({
    token,
    platform: Platform.OS === "ios" ? "ios" : "android",
  });
  registered = true;
  return true;
}
