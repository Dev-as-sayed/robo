export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000/api/v1"
).replace(/\/$/, "");

export const SUPPORT_EMAIL =
  process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() ?? "";

export const SUPPORT_URL =
  process.env.EXPO_PUBLIC_SUPPORT_URL?.trim() ||
  "https://github.com/Dev-as-sayed/robo/issues/new";
