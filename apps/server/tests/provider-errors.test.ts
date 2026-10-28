import { describe, expect, it } from "vitest";
import {
  classifyProviderError,
  providerErrorCode,
  toProviderError,
} from "../src/modules/ai/provider-errors";

function withStatus(status: number, message = "provider error", code?: string) {
  return Object.assign(new Error(message), { status, ...(code ? { code } : {}) });
}

describe("provider error classification", () => {
  it.each([
    [withStatus(429), "rate_limit", "AI_RATE_LIMITED"],
    [withStatus(401), "auth", "AI_AUTH_FAILED"],
    [withStatus(504), "timeout", "AI_PROVIDER_UNAVAILABLE"],
    [withStatus(400, "maximum context length exceeded"), "context_length", "AI_CONTEXT_TOO_LONG"],
    [withStatus(422, "blocked by safety policy"), "content_filter", "AI_CONTENT_BLOCKED"],
    [withStatus(404, "model not found"), "model_not_found", "AI_CONFIGURATION_INVALID"],
    [withStatus(400, "invalid field"), "bad_request", "AI_PROVIDER_UNAVAILABLE"],
    [withStatus(503), "server", "AI_PROVIDER_UNAVAILABLE"],
    [withStatus(200, "socket hang up", "ECONNRESET"), "network", "AI_PROVIDER_UNAVAILABLE"],
    [withStatus(200, "mystery"), "unknown", "AI_PROVIDER_UNAVAILABLE"],
  ])("classifies %#", (error, kind, code) => {
    expect(classifyProviderError(error)).toBe(kind);
    expect(providerErrorCode(classifyProviderError(error))).toBe(code);
  });

  it("keeps an existing AI_ error unchanged", () => {
    const original = new Error("AI_EMPTY_RESPONSE");
    expect(toProviderError(original)).toBe(original);
  });

  it("wraps an unclassified provider error with a safe AI code", () => {
    expect(toProviderError(new Error("boom")).message).toBe(
      "AI_PROVIDER_UNAVAILABLE"
    );
  });
});
