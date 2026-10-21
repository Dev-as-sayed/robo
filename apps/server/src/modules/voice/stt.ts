import { z } from "zod";
import type { DeviceAudioTurn } from "@robo/shared/realtime";
import { env } from "../../config/env";

const GROQ_STT_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

const localResponseSchema = z.object({
  text: z.string(),
  language: z.string().optional(),
  durationMs: z.number().nonnegative().optional(),
});

const groqResponseSchema = z.object({
  text: z.string(),
  language: z.string().optional(),
  duration: z.number().nonnegative().optional(),
});

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

export interface TranscriptionResult {
  text: string;
  language: string;
  provider: "local" | "groq";
  durationMs: number;
}

export interface SttOptions {
  language?: string;
  serviceUrl?: string;
  groqApiKey?: string;
  model?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}

function timeoutSignal(timeoutMs: number): AbortSignal {
  return AbortSignal.timeout(timeoutMs);
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

export function pcm16ToWav(
  pcm: Buffer,
  sampleRate: number,
  channels = 1
): Buffer {
  const bytesPerSample = 2;
  const dataSize = pcm.length;
  const byteRate = sampleRate * channels * bytesPerSample;
  const blockAlign = channels * bytesPerSample;
  const header = Buffer.alloc(44);

  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcm]);
}

async function transcribeWithLocalService(
  turn: DeviceAudioTurn,
  options: Required<Pick<SttOptions, "serviceUrl" | "timeoutMs">> &
    Pick<SttOptions, "language" | "fetchImpl">
): Promise<TranscriptionResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(joinUrl(options.serviceUrl, "/transcribe"), {
    method: "POST",
    headers: {
      "content-type": "application/octet-stream",
      "x-audio-codec": turn.codec,
      "x-sample-rate": String(turn.sampleRate),
      "x-turn-id": turn.turnId,
      ...(options.language ? { "x-language": options.language } : {}),
    },
    body: turn.audio,
    signal: timeoutSignal(options.timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`STT_SERVICE_${response.status}`);
  }

  const parsed = localResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("STT_INVALID_RESPONSE");
  }

  return {
    text: parsed.data.text.trim(),
    language: parsed.data.language ?? options.language ?? "en",
    provider: "local",
    durationMs: parsed.data.durationMs ?? turn.durationMs,
  };
}

async function transcribeWithGroq(
  turn: DeviceAudioTurn,
  options: Required<Pick<SttOptions, "groqApiKey" | "model" | "timeoutMs">> &
    Pick<SttOptions, "language" | "fetchImpl">
): Promise<TranscriptionResult> {
  if (turn.codec !== "pcm16") {
    throw new Error("STT_UNSUPPORTED_CODEC");
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const form = new FormData();
  const audio = pcm16ToWav(turn.audio, turn.sampleRate);
  form.append("file", new Blob([audio], { type: "audio/wav" }), "audio.wav");
  form.append("model", options.model);
  form.append("response_format", "json");
  form.append("temperature", "0");
  const groqLanguage = options.language?.split(/[-_]/)[0];
  if (groqLanguage) {
    form.append("language", groqLanguage);
  }

  const response = await fetchImpl(GROQ_STT_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${options.groqApiKey}`,
    },
    body: form,
    signal: timeoutSignal(options.timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`STT_GROQ_${response.status}`);
  }

  const parsed = groqResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("STT_INVALID_RESPONSE");
  }

  return {
    text: parsed.data.text.trim(),
    language: parsed.data.language ?? options.language ?? "en",
    provider: "groq",
    durationMs:
      parsed.data.duration !== undefined
        ? Math.round(parsed.data.duration * 1_000)
        : turn.durationMs,
  };
}

export async function transcribeAudio(
  turn: DeviceAudioTurn,
  options: SttOptions = {}
): Promise<TranscriptionResult> {
  const serviceUrl = options.serviceUrl ?? env.STT_SERVICE_URL;
  const groqApiKey = options.groqApiKey ?? env.GROQ_API_KEY;
  const language = options.language ?? env.STT_LANGUAGE;
  const model = options.model ?? env.GROQ_STT_MODEL;
  const timeoutMs = options.timeoutMs ?? env.STT_SERVICE_TIMEOUT_MS;

  if (!serviceUrl && !groqApiKey) {
    throw new Error("STT_NOT_CONFIGURED");
  }

  let localError: unknown;
  if (serviceUrl) {
    try {
      return await transcribeWithLocalService(turn, {
        serviceUrl,
        timeoutMs,
        language,
        fetchImpl: options.fetchImpl,
      });
    } catch (error) {
      localError = error;
    }
  }

  if (groqApiKey) {
    try {
      return await transcribeWithGroq(turn, {
        groqApiKey,
        model,
        timeoutMs,
        language,
        fetchImpl: options.fetchImpl,
      });
    } catch (error) {
      throw new Error("STT_FAILED", { cause: { localError, groqError: error } });
    }
  }

  throw new Error("STT_FAILED", { cause: localError });
}
