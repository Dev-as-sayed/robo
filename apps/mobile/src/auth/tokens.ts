import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const ACCESS_TOKEN_KEY = "robo.accessToken";
const REFRESH_TOKEN_KEY = "robo.refreshToken";

let authGeneration = 0;
let signOutDepth = 0;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(key, value);
    return;
  }

  await SecureStore.setItemAsync(key, value);
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return globalThis.localStorage?.getItem(key) ?? null;
  }

  return SecureStore.getItemAsync(key);
}

async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    globalThis.localStorage?.removeItem(key);
    return;
  }

  await SecureStore.deleteItemAsync(key);
}

export async function getTokens(): Promise<AuthTokens | null> {
  const [accessToken, refreshToken] = await Promise.all([
    getItem(ACCESS_TOKEN_KEY),
    getItem(REFRESH_TOKEN_KEY),
  ]);

  if (!accessToken || !refreshToken) {
    return null;
  }

  return { accessToken, refreshToken };
}

export async function setTokens(tokens: AuthTokens): Promise<void> {
  await Promise.all([
    setItem(ACCESS_TOKEN_KEY, tokens.accessToken),
    setItem(REFRESH_TOKEN_KEY, tokens.refreshToken),
  ]);
}

export function currentAuthGeneration(): number {
  return authGeneration;
}

export function beginSignOut(): void {
  signOutDepth += 1;
}

export function endSignOut(): void {
  signOutDepth = Math.max(0, signOutDepth - 1);
}

export function isSigningOut(): boolean {
  return signOutDepth > 0;
}

export async function setTokensIfCurrent(tokens: AuthTokens, generation: number): Promise<boolean> {
  if (generation !== authGeneration) {
    return false;
  }

  await setTokens(tokens);

  if (generation !== authGeneration) {
    await clearTokens();
    return false;
  }

  return true;
}

export async function clearTokens(): Promise<void> {
  authGeneration += 1;
  await Promise.all([deleteItem(ACCESS_TOKEN_KEY), deleteItem(REFRESH_TOKEN_KEY)]);
}
