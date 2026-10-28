import * as ImagePicker from "expo-image-picker";
import * as Notifications from "expo-notifications";
import { Alert, Linking } from "react-native";

export interface PermissionState {
  status: string;
  canAskAgain?: boolean;
}

export interface PermissionApi {
  get: () => Promise<PermissionState>;
  request: () => Promise<PermissionState>;
}

function granted(state: PermissionState): boolean {
  return state.status === "granted";
}

function confirm(title: string, message: string): Promise<boolean> {
  return new Promise(resolve => {
    Alert.alert(title, message, [
      { text: "Not now", style: "cancel", onPress: () => resolve(false) },
      { text: "Continue", onPress: () => resolve(true) },
    ]);
  });
}

function explainSettings(): void {
  Alert.alert(
    "Permission needed",
    "You can grant this later in your phone settings.",
    [
      { text: "Cancel", style: "cancel" },
      { text: "Open settings", onPress: () => void Linking.openSettings() },
    ]
  );
}

/**
 * Shows a short rationale before the system permission dialog. If the OS will no
 * longer ask, points the student at Settings instead of silently doing nothing.
 */
export async function ensurePermissionWithExplanation(options: {
  title: string;
  message: string;
  api: PermissionApi;
}): Promise<boolean> {
  const current = await options.api.get();
  if (granted(current)) return true;

  if (current.canAskAgain === false) {
    explainSettings();
    return false;
  }

  if (!(await confirm(options.title, options.message))) {
    return false;
  }

  const next = await options.api.request();
  if (granted(next)) return true;

  if (next.canAskAgain === false) {
    explainSettings();
  }
  return false;
}

export const mediaLibraryPermission: PermissionApi = {
  get: async () => {
    const { status, canAskAgain } =
      await ImagePicker.getMediaLibraryPermissionsAsync();
    return { status, canAskAgain };
  },
  request: async () => {
    const { status, canAskAgain } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    return { status, canAskAgain };
  },
};

export const notificationPermission: PermissionApi = {
  get: async () => {
    const { status, canAskAgain } = await Notifications.getPermissionsAsync();
    return { status, canAskAgain };
  },
  request: async () => {
    const { status, canAskAgain } =
      await Notifications.requestPermissionsAsync();
    return { status, canAskAgain };
  },
};
