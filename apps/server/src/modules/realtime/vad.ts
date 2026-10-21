import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import type {
  FrameProcessor as FrameProcessorType,
  Resampler,
} from "@ricky0123/vad-node";
import type { InferenceSession, Tensor } from "onnxruntime-node";

const require = createRequire(import.meta.url);
const SAMPLE_RATE = 16_000;
const FRAME_SAMPLES = 1_536;
const FRAME_MS = (FRAME_SAMPLES / SAMPLE_RATE) * 1_000;

type Ort = typeof import("onnxruntime-node");
type VadPackage = typeof import("@ricky0123/vad-node");

export interface VadTurn {
  push: (chunk: Buffer) => Promise<boolean>;
}

export interface VadDetector {
  startTurn: (sampleRate: number) => VadTurn | null;
}

export interface SileroVadOptions {
  modelPath?: string;
  silenceMs?: number;
  minSpeechMs?: number;
  positiveSpeechThreshold?: number;
  negativeSpeechThreshold?: number;
}

function defaultModelPath(): string {
  const packageJson = require.resolve("@ricky0123/vad-node/package.json");
  return path.join(path.dirname(packageJson), "dist", "silero_vad.onnx");
}

function framesForMs(ms: number): number {
  return Math.max(0, Math.round(ms / FRAME_MS));
}

class SileroVadTurn implements VadTurn {
  private readonly ort: Ort;
  private readonly vadPackage: VadPackage;
  private readonly session: InferenceSession;
  private readonly processor: FrameProcessorType;
  private readonly resampler: Resampler;
  private hidden: Tensor;
  private cell: Tensor;
  private readonly sampleRate: Tensor;

  constructor(
    ort: Ort,
    vadPackage: VadPackage,
    session: InferenceSession,
    nativeSampleRate: number,
    options: Required<
      Pick<
        SileroVadOptions,
        | "silenceMs"
        | "minSpeechMs"
        | "positiveSpeechThreshold"
        | "negativeSpeechThreshold"
      >
    >
  ) {
    this.ort = ort;
    this.vadPackage = vadPackage;
    this.session = session;
    this.hidden = this.zeroState();
    this.cell = this.zeroState();
    this.sampleRate = new ort.Tensor("int64", [16_000n]);

    const processFrame = async (
      frame: Float32Array
    ): Promise<{ notSpeech: number; isSpeech: number }> => {
      const input = new ort.Tensor("float32", frame, [1, frame.length]);
      const output = await this.session.run({
        input,
        h: this.hidden,
        c: this.cell,
        sr: this.sampleRate,
      });

      this.hidden = output.hn as Tensor;
      this.cell = output.cn as Tensor;
      const data = output.output.data as Float32Array;
      const isSpeech = Number(data[0] ?? 0);
      return { isSpeech, notSpeech: 1 - isSpeech };
    };

    this.processor = new vadPackage.FrameProcessor(
      processFrame,
      () => this.resetState(),
      {
        positiveSpeechThreshold: options.positiveSpeechThreshold,
        negativeSpeechThreshold: options.negativeSpeechThreshold,
        redemptionFrames: Math.max(1, framesForMs(options.silenceMs)),
        preSpeechPadFrames: 1,
        frameSamples: FRAME_SAMPLES,
        minSpeechFrames: Math.max(1, framesForMs(options.minSpeechMs)),
        submitUserSpeechOnPause: false,
      }
    );
    this.processor.resume();

    this.resampler = new vadPackage.Resampler({
      nativeSampleRate,
      targetSampleRate: SAMPLE_RATE,
      targetFrameSize: FRAME_SAMPLES,
    });
  }

  async push(chunk: Buffer): Promise<boolean> {
    if (chunk.length < 2) {
      return false;
    }

    const samples = new Float32Array(Math.floor(chunk.length / 2));
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = chunk.readInt16LE(index * 2) / 32_768;
    }

    for (const frame of this.resampler.process(samples)) {
      const result = await this.processor.process(frame);
      if (result.msg === this.vadPackage.Message.SpeechEnd) {
        return true;
      }
    }

    return false;
  }

  private zeroState(): Tensor {
    return new this.ort.Tensor(
      "float32",
      new Float32Array(2 * 64),
      [2, 1, 64]
    );
  }

  private resetState(): void {
    this.hidden = this.zeroState();
    this.cell = this.zeroState();
  }
}

export class SileroVad implements VadDetector {
  private readonly options: Required<
    Pick<
      SileroVadOptions,
      | "silenceMs"
      | "minSpeechMs"
      | "positiveSpeechThreshold"
      | "negativeSpeechThreshold"
    >
  >;
  private constructor(
    private readonly ort: Ort,
    private readonly vadPackage: VadPackage,
    private readonly session: InferenceSession,
    options: SileroVadOptions
  ) {
    this.options = {
      silenceMs: options.silenceMs ?? 800,
      minSpeechMs: options.minSpeechMs ?? 250,
      positiveSpeechThreshold: options.positiveSpeechThreshold ?? 0.5,
      negativeSpeechThreshold: options.negativeSpeechThreshold ?? 0.35,
    };
  }

  static async create(options: SileroVadOptions = {}): Promise<SileroVad> {
    const [ort, vadPackage, modelFile] = await Promise.all([
      import("onnxruntime-node"),
      import("@ricky0123/vad-node"),
      readFile(options.modelPath ?? defaultModelPath()),
    ]);
    const model = modelFile.buffer.slice(
      modelFile.byteOffset,
      modelFile.byteOffset + modelFile.byteLength
    ) as ArrayBuffer;
    const session = await ort.InferenceSession.create(model);
    return new SileroVad(ort, vadPackage, session, options);
  }

  startTurn(sampleRate: number): VadTurn | null {
    if (!Number.isFinite(sampleRate) || sampleRate < SAMPLE_RATE) {
      return null;
    }

    return new SileroVadTurn(
      this.ort,
      this.vadPackage,
      this.session,
      sampleRate,
      this.options
    );
  }
}
