import { describe, expect, it } from "vitest";
import { loadFallbackSpeech } from "../src/modules/voice/fallback";

describe("bundled fallback speech", () => {
  it("loads the PCM asset with its sample rate and duration", async () => {
    const speech = await loadFallbackSpeech();

    expect(speech).toMatchObject({
      codec: "pcm16",
      sampleRate: 22_050,
      provider: "piper",
    });
    expect(speech.audio.length).toBeGreaterThan(1_000);
    expect(speech.durationMs).toBeGreaterThan(1_000);
  });
});
