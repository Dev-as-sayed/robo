import { describe, expect, it, vi } from "vitest";
import type { DeviceAudioTurn } from "@robo/shared/realtime";
import {
  pcm16ToWav,
  transcribeAudio,
  type FetchLike,
} from "../src/modules/voice/stt";

const turn: DeviceAudioTurn = {
  turnId: "turn-1",
  userId: "user-1",
  deviceId: "device-1",
  codec: "pcm16",
  sampleRate: 16_000,
  audio: Buffer.from([0, 1, 2, 3]),
  durationMs: 500,
  receivedAt: new Date(0),
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("speech-to-text", () => {
  it("uses the local faster-whisper service first", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ text: "  what class is next?  ", language: "en", durationMs: 420 })
    ) as unknown as FetchLike;

    const result = await transcribeAudio(turn, {
      serviceUrl: "http://stt.local:8000",
      language: "en",
      fetchImpl,
    });

    expect(result).toMatchObject({
      text: "what class is next?",
      language: "en",
      provider: "local",
      durationMs: 420,
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0];
    expect(url).toBe("http://stt.local:8000/transcribe");
    expect(init?.headers).toMatchObject({
      "content-type": "application/octet-stream",
      "x-audio-codec": "pcm16",
      "x-sample-rate": "16000",
    });
  });

  it("falls back to Groq Whisper when the local service fails", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "down" }, 503))
      .mockResolvedValueOnce(
        jsonResponse({ text: " remind me at 7", language: "en", duration: 1.25 })
      ) as unknown as FetchLike;

    const result = await transcribeAudio(turn, {
      serviceUrl: "http://stt.local:8000",
      groqApiKey: "groq-key",
      language: "en",
      fetchImpl,
    });

    expect(result).toMatchObject({
      text: "remind me at 7",
      provider: "groq",
      durationMs: 1250,
    });

    const [, init] = vi.mocked(fetchImpl).mock.calls[1];
    expect(init?.headers).toEqual({ authorization: "Bearer groq-key" });
    expect(init?.body).toBeInstanceOf(FormData);

    const form = init?.body as FormData;
    expect(form.get("model")).toBe("whisper-large-v3-turbo");
    expect(form.get("language")).toBe("en");

    const file = form.get("file") as File;
    const audio = Buffer.from(await file.arrayBuffer());
    expect(audio.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(audio.length).toBe(turn.audio.length + 44);
  });

  it("returns an empty transcript without falling back", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ text: "   ", language: "en" })
    ) as unknown as FetchLike;

    const result = await transcribeAudio(turn, {
      serviceUrl: "http://stt.local:8000",
      groqApiKey: "groq-key",
      fetchImpl,
    });

    expect(result.text).toBe("");
    expect(result.provider).toBe("local");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("requires a configured provider", async () => {
    await expect(
      transcribeAudio(turn, { serviceUrl: "", groqApiKey: "" })
    ).rejects.toThrow("STT_NOT_CONFIGURED");
  });

  it("fails when both providers fail", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ error: "down" }, 500)
    ) as unknown as FetchLike;

    await expect(
      transcribeAudio(turn, {
        serviceUrl: "http://stt.local:8000",
        groqApiKey: "groq-key",
        fetchImpl,
      })
    ).rejects.toThrow("STT_FAILED");
  });

  it("wraps PCM16 audio in a valid WAV header", () => {
    const pcm = Buffer.alloc(320);
    const wav = pcm16ToWav(pcm, 16_000, 1);

    expect(wav.length).toBe(364);
    expect(wav.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(wav.readUInt32LE(24)).toBe(16_000);
    expect(wav.readUInt16LE(22)).toBe(1);
    expect(wav.readUInt32LE(40)).toBe(320);
  });
});
