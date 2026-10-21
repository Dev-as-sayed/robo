import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { SileroVad } from "../src/modules/realtime/vad";

let vad: SileroVad;

function parseWav(wav: Buffer): { sampleRate: number; audio: Buffer } {
  const sampleRate = wav.readUInt32LE(24);
  let offset = 12;

  while (offset + 8 <= wav.length) {
    const id = wav.toString("ascii", offset, offset + 4);
    const size = wav.readUInt32LE(offset + 4);
    if (id === "data") {
      return {
        sampleRate,
        audio: wav.subarray(offset + 8, offset + 8 + size),
      };
    }
    offset += 8 + size + (size % 2);
  }

  throw new Error("wav has no data chunk");
}

beforeAll(async () => {
  vad = await SileroVad.create();
}, 30_000);

describe("silero vad", () => {
  it("ignores silence at 16 kHz", async () => {
    const turn = vad.startTurn(16_000);

    expect(turn).not.toBeNull();
    await expect(turn?.push(Buffer.alloc(32_000))).resolves.toBe(false);
  });

  it("resamples 48 kHz audio", async () => {
    const turn = vad.startTurn(48_000);

    expect(turn).not.toBeNull();
    await expect(turn?.push(Buffer.alloc(96_000))).resolves.toBe(false);
  });

  it("detects the end of real speech after silence", async () => {
    const wav = parseWav(
      await readFile(new URL("./fixtures/speech.wav", import.meta.url))
    );
    const turn = vad.startTurn(wav.sampleRate);
    expect(turn).not.toBeNull();

    const audio = Buffer.concat([wav.audio, Buffer.alloc(wav.sampleRate * 2)]);
    const chunkSize = (wav.sampleRate * 2) / 50;
    let ended = false;

    for (let offset = 0; offset < audio.length && !ended; offset += chunkSize) {
      ended = await turn?.push(audio.subarray(offset, offset + chunkSize)) ?? false;
    }

    expect(ended).toBe(true);
  });

  it("skips sample rates below 16 kHz", () => {
    expect(vad.startTurn(8_000)).toBeNull();
  });
});
