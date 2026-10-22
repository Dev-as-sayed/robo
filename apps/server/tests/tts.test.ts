import { describe, expect, it, vi } from "vitest";
import {
  resolveTtsVoice,
  synthesizeSpeech,
  type TtsOptions,
} from "../src/modules/voice/tts";
import type { FetchLike } from "../src/modules/voice/stt";

function audioResponse(
  bytes: Buffer,
  headers: Record<string, string> = {}
): Response {
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: { "x-audio-codec": "pcm16", "x-sample-rate": "16000", ...headers },
  });
}

describe("text-to-speech", () => {
  it("selects a voice from the language map with a primary-subtag fallback", () => {
    const voiceMap = "en:en_US-amy-medium,hi-IN:hi_IN-pratham-medium";

    expect(resolveTtsVoice("en-US", voiceMap, "en_US-lessac-medium")).toBe(
      "en_US-amy-medium"
    );
    expect(resolveTtsVoice("hi_IN", voiceMap, "en_US-lessac-medium")).toBe(
      "hi_IN-pratham-medium"
    );
    expect(resolveTtsVoice("fr", voiceMap, "en_US-lessac-medium")).toBe(
      "en_US-lessac-medium"
    );
    expect(resolveTtsVoice(undefined, voiceMap, "en_US-lessac-medium")).toBe(
      "en_US-lessac-medium"
    );
  });

  it("sends the sentence to Piper and returns PCM audio", async () => {
    const audio = Buffer.alloc(640);
    const fetchImpl = vi.fn(async () => audioResponse(audio)) as unknown as FetchLike;

    const result = await synthesizeSpeech("  Your next class is biology.  ", {
      serviceUrl: "http://tts.local:8000",
      voice: "en_US-lessac-medium",
      language: "en",
      fetchImpl,
    });

    expect(result).toMatchObject({
      codec: "pcm16",
      sampleRate: 16_000,
      provider: "piper",
      durationMs: 20,
    });
    expect(result.audio.equals(audio)).toBe(true);

    const [url, init] = vi.mocked(fetchImpl).mock.calls[0];
    expect(url).toBe("http://tts.local:8000/synthesize");
    expect(init?.headers).toMatchObject({ "content-type": "application/json" });
    expect(JSON.parse(String(init?.body))).toEqual({
      text: "Your next class is biology.",
      voice: "en_US-lessac-medium",
      language: "en",
      sampleRate: 16_000,
      format: "pcm16",
    });
  });

  it("honors codec, sample rate and duration headers", async () => {
    const fetchImpl = vi.fn(async () =>
      audioResponse(Buffer.alloc(10), {
        "x-audio-codec": "opus",
        "x-sample-rate": "24000",
        "x-duration-ms": "350",
      })
    ) as unknown as FetchLike;

    const result = await synthesizeSpeech("Hello.", {
      serviceUrl: "http://tts.local:8000",
      fetchImpl,
    });

    expect(result).toMatchObject({
      codec: "opus",
      sampleRate: 24_000,
      durationMs: 350,
    });
  });

  it("requires a configured TTS service", async () => {
    const options: TtsOptions = { serviceUrl: "" };
    await expect(synthesizeSpeech("Hello.", options)).rejects.toThrow(
      "TTS_NOT_CONFIGURED"
    );
  });

  it("rejects empty text", async () => {
    await expect(
      synthesizeSpeech("   ", { serviceUrl: "http://tts.local:8000" })
    ).rejects.toThrow("TTS_TEXT_REQUIRED");
  });

  it("rejects provider errors and empty audio", async () => {
    const failing = vi.fn(async () => new Response("nope", { status: 503 })) as unknown as FetchLike;
    await expect(
      synthesizeSpeech("Hello.", { serviceUrl: "http://tts.local:8000", fetchImpl: failing })
    ).rejects.toThrow("TTS_FAILED");

    const empty = vi.fn(async () => audioResponse(Buffer.alloc(0))) as unknown as FetchLike;
    await expect(
      synthesizeSpeech("Hello.", { serviceUrl: "http://tts.local:8000", fetchImpl: empty })
    ).rejects.toThrow("TTS_EMPTY_RESPONSE");
  });
});
