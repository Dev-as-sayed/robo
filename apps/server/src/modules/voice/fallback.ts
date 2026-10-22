import { readFile } from "node:fs/promises";
import type { SpeechResult } from "./tts";

const FALLBACK_PATH = new URL("../../../assets/fallback-en.pcm", import.meta.url);
const FALLBACK_SAMPLE_RATE = 22_050;

let cached: SpeechResult | null = null;

export async function loadFallbackSpeech(): Promise<SpeechResult> {
  if (cached) {
    return cached;
  }

  const audio = await readFile(FALLBACK_PATH);
  cached = {
    audio,
    codec: "pcm16",
    sampleRate: FALLBACK_SAMPLE_RATE,
    provider: "piper",
    durationMs: Math.round((audio.length / (FALLBACK_SAMPLE_RATE * 2)) * 1_000),
  };

  return cached;
}
