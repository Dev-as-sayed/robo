import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const CONVERSATION_KEY = "robo.chat.conversationId";

export async function loadSavedConversationId(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      return globalThis.localStorage?.getItem(CONVERSATION_KEY) ?? null;
    }

    return await SecureStore.getItemAsync(CONVERSATION_KEY);
  } catch {
    return null;
  }
}

export async function saveConversationId(id: string | null): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (id) {
        globalThis.localStorage?.setItem(CONVERSATION_KEY, id);
      } else {
        globalThis.localStorage?.removeItem(CONVERSATION_KEY);
      }
      return;
    }

    if (id) {
      await SecureStore.setItemAsync(CONVERSATION_KEY, id);
    } else {
      await SecureStore.deleteItemAsync(CONVERSATION_KEY);
    }
  } catch {
    return;
  }
}
