/// <reference types="expo/types" />
/// <reference types="expo-router/types" />

declare const process: {
  env: {
    EXPO_PUBLIC_API_URL?: string;
    EXPO_PUBLIC_SENTRY_DSN?: string;
    EXPO_PUBLIC_SENTRY_ENVIRONMENT?: string;
    EXPO_PUBLIC_SUPPORT_EMAIL?: string;
    EXPO_PUBLIC_SUPPORT_URL?: string;
  };
};
