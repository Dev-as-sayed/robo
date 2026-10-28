export type ProviderErrorKind =
  | "rate_limit"
  | "auth"
  | "timeout"
  | "context_length"
  | "content_filter"
  | "model_not_found"
  | "bad_request"
  | "server"
  | "network"
  | "unknown";

const NETWORK_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EPIPE",
  "UND_ERR_CONNECT_TIMEOUT",
]);

function statusOf(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const record = error as Record<string, unknown>;
  const response =
    record.response && typeof record.response === "object"
      ? (record.response as Record<string, unknown>)
      : undefined;
  const candidate =
    record.status ?? record.statusCode ?? response?.status ?? response?.statusCode;
  return typeof candidate === "number" ? candidate : undefined;
}

function textOf(error: unknown): string {
  if (!error || typeof error !== "object") return String(error ?? "");
  const record = error as Record<string, unknown>;
  return [
    record.message,
    record.code,
    record.type,
    record.name,
    record.cause instanceof Error ? record.cause.message : undefined,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
}

export function classifyProviderError(error: unknown): ProviderErrorKind {
  const status = statusOf(error);
  const text = textOf(error).toLowerCase();

  if (status === 401 || status === 403 || /invalid api key|unauthorized|authentication/.test(text)) {
    return "auth";
  }

  if (status === 429 || /rate.?limit|quota exceeded|too many requests/.test(text)) {
    return "rate_limit";
  }

  if (
    status === 408 ||
    status === 504 ||
    /timed? ?out|etimedout|aborted/.test(text)
  ) {
    return "timeout";
  }

  if (
    /context (length|window)|maximum context|too many tokens|token limit/.test(text)
  ) {
    return "context_length";
  }

  if (/content (filter|policy)|safety|blocked by/.test(text)) {
    return "content_filter";
  }

  if (status === 404 || /model .*not found|does not exist/.test(text)) {
    return "model_not_found";
  }

  if (status === 400 || status === 422) {
    return "bad_request";
  }

  if (status !== undefined && status >= 500) {
    return "server";
  }

  if (NETWORK_CODES.has(String((error as { code?: unknown })?.code ?? ""))) {
    return "network";
  }

  if (/fetch failed|network|socket hang up|connection/.test(text)) {
    return "network";
  }

  return "unknown";
}

export function providerErrorCode(kind: ProviderErrorKind): string {
  switch (kind) {
    case "rate_limit":
      return "AI_RATE_LIMITED";
    case "auth":
      return "AI_AUTH_FAILED";
    case "context_length":
      return "AI_CONTEXT_TOO_LONG";
    case "content_filter":
      return "AI_CONTENT_BLOCKED";
    case "model_not_found":
      return "AI_CONFIGURATION_INVALID";
    case "timeout":
    case "server":
    case "network":
    case "bad_request":
    case "unknown":
      return "AI_PROVIDER_UNAVAILABLE";
  }
}

export function toProviderError(error: unknown): Error {
  if (error instanceof Error && error.message.startsWith("AI_")) {
    return error;
  }

  return new Error(providerErrorCode(classifyProviderError(error)));
}
