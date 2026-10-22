import type { AudioCodec } from "@robo/shared/realtime";
import { env } from "../../config/env";
import type { FetchLike } from "./stt";

export interface SpeechResult {
  audio: Buffer;
  codec: AudioCodec;
  sampleRate: number;
  provider: "piper";
  durationMs: number;
}

export interface TtsOptions {
  serviceUrl?: string;
  voice?: string;
  language?: string;
  sampleRate?: number;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function parseHeaderNumber(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeLanguage(language: string): string {
  return language.trim().toLowerCase().replace(/_/g, "-");
}

function parseVoiceMap(raw: string): Map<string, string> {
  const voices = new Map<string, string>();

  for (const entry of raw.split(",")) {
    const separator = entry.indexOf(":");
    if (separator <= 0) {
      continue;
    }

    const language = normalizeLanguage(entry.slice(0, separator));
    const voice = entry.slice(separator + 1).trim();
    if (language && voice) {
      voices.set(language, voice);
    }
  }

  return voices;
}

export function resolveTtsVoice(
  language?: string,
  voiceMap: string | undefined = env.TTS_VOICE_MAP,
  fallback: string | undefined = env.TTS_VOICE
): string | undefined {
  if (language && voiceMap) {
    const normalized = normalizeLanguage(language);
    const voices = parseVoiceMap(voiceMap);
    const selected =
      voices.get(normalized) ?? voices.get(normalized.split("-")[0]);

    if (selected) {
      return selected;
    }
  }

  return fallback;
}

export async function synthesizeSpeech(
  text: string,
  options: TtsOptions = {}
): Promise<SpeechResult> {
  const content = text.trim();
  if (!content) {
    throw new Error("TTS_TEXT_REQUIRED");
  }

  const serviceUrl = options.serviceUrl ?? env.TTS_SERVICE_URL;
  if (!serviceUrl) {
    throw new Error("TTS_NOT_CONFIGURED");
  }

  const voice = options.voice ?? resolveTtsVoice(options.language);
  const sampleRate = options.sampleRate ?? env.TTS_SAMPLE_RATE;
  const timeoutMs = options.timeoutMs ?? env.TTS_SERVICE_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;

  const response = await fetchImpl(joinUrl(serviceUrl, "/synthesize"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "audio/pcm",
    },
    body: JSON.stringify({
      text: content,
      ...(voice ? { voice } : {}),
      ...(options.language ? { language: options.language } : {}),
      sampleRate,
      format: "pcm16",
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error("TTS_FAILED");
  }

  const audio = Buffer.from(await response.arrayBuffer());
  if (audio.length === 0) {
    throw new Error("TTS_EMPTY_RESPONSE");
  }

  const codec: AudioCodec =
    response.headers.get("x-audio-codec") === "opus" ? "opus" : "pcm16";
  const responseSampleRate =
    parseHeaderNumber(response.headers.get("x-sample-rate")) ?? sampleRate;
  const headerDuration = parseHeaderNumber(response.headers.get("x-duration-ms"));
  const durationMs =
    headerDuration ??
    (codec === "pcm16"
      ? Math.round((audio.length / (responseSampleRate * 2)) * 1_000)
      : 0);

  return {
    audio,
    codec,
    sampleRate: responseSampleRate,
    provider: "piper",
    durationMs,
  };
}
