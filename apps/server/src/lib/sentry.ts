import * as Sentry from "@sentry/node";
import { env } from "../config/env";

let enabled = false;

export function initSentry(): boolean {
  if (!env.SENTRY_DSN) {
    return false;
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
      }
      return event;
    },
  });

  enabled = true;
  return true;
}

export function isSentryEnabled(): boolean {
  return enabled;
}

export function captureException(error: unknown): void {
  if (enabled) {
    Sentry.captureException(error);
  }
}
