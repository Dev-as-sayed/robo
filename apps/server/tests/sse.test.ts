import { describe, expect, it } from "vitest";
import { formatSseEvent } from "../src/http/sse";

describe("server-sent events", () => {
  it("formats named events with JSON data", () => {
    expect(formatSseEvent("token", { token: "Hello\nworld" })).toBe(
      "event: token\ndata: {\"token\":\"Hello\\nworld\"}\n\n"
    );
  });
});
