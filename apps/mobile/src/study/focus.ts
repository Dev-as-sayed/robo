import * as Linking from "expo-linking";
import { Alert, Platform } from "react-native";

let prompted = false;

export function resetFocusPrompt(): void {
  prompted = false;
}

/**
 * Opens the closest system screen for silencing distractions. Android has a
 * dedicated Do Not Disturb screen; iOS does not allow apps to open Focus
 * settings, so it falls back to the app's settings page.
 */
export async function openFocusSettings(): Promise<void> {
  if (Platform.OS === "android") {
    try {
      await Linking.sendIntent("android.settings.ZEN_MODE_SETTINGS");
      return;
    } catch {
      // Fall through to the app settings screen.
    }
  }

  await Linking.openSettings();
}

/**
 * Offers Do Not Disturb once per app session when a study session starts.
 * Declining is safe: the study timer keeps running.
 */
export function promptForDoNotDisturb(): Promise<void> {
  if (prompted) {
    return Promise.resolve();
  }
  prompted = true;

  return new Promise(resolve => {
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      resolve();
    };

    Alert.alert(
      "Turn on Do Not Disturb",
      Platform.OS === "ios"
        ? "Silence calls and alerts while you study. Turn on a Focus mode in Settings, then come back to the timer."
        : "Silence calls and alerts while you study. Open Do Not Disturb settings and turn it on, then come back to the timer.",
      [
        { text: "Not now", style: "cancel", onPress: finish },
        {
          text: "Open settings",
          onPress: () => {
            void openFocusSettings()
              .catch(() => undefined)
              .finally(finish);
          },
        },
      ],
      { cancelable: true, onDismiss: finish }
    );
  });
}
