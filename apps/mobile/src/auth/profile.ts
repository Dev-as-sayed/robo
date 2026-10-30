import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { User } from "@/types";

const USER_KEY = "robo.user";

async function setItem(value: string): Promise<void> {
  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(USER_KEY, value);
    return;
  }

  await SecureStore.setItemAsync(USER_KEY, value);
}

async function getItem(): Promise<string | null> {
  if (Platform.OS === "web") {
    return globalThis.localStorage?.getItem(USER_KEY) ?? null;
  }

  return SecureStore.getItemAsync(USER_KEY);
}

async function deleteItem(): Promise<void> {
  if (Platform.OS === "web") {
    globalThis.localStorage?.removeItem(USER_KEY);
    return;
  }

  await SecureStore.deleteItemAsync(USER_KEY);
}

export async function getCachedUser(): Promise<User | null> {
  const raw = await getItem();

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<User> | null;
    return parsed && typeof parsed.id === "string" ? (parsed as User) : null;
  } catch {
    return null;
  }
}

export async function setCachedUser(user: User): Promise<void> {
  await setItem(JSON.stringify(user));
}

export async function clearCachedUser(): Promise<void> {
  await deleteItem();
}
