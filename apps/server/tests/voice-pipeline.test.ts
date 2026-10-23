import { describe, expect, it, vi } from "vitest";
import type {
  DeviceAudioTurn,
  DeviceServerMessage,
  DeviceSession,
  DeviceState,
} from "@robo/shared/realtime";
import {
  createVoiceTurnHandler,
  type VoiceReplyStreamOptions,
} from "../src/modules/voice/pipeline";
import type { SpeechResult } from "../src/modules/voice/tts";
import type { TranscriptionResult } from "../src/modules/voice/stt";

const turn: DeviceAudioTurn = {
  turnId: "turn-1",
  userId: "user-1",
  deviceId: "device-1",
  codec: "pcm16",
  sampleRate: 16_000,
  audio: Buffer.from([1, 2, 3]),
  durationMs: 900,
  receivedAt: new Date(0),
};

const silentLogger = {
  info: (): void => undefined,
  warn: (): void => undefined,
  error: (): void => undefined,
};

interface FakeSession extends DeviceSession {
  messages: DeviceServerMessage[];
  audio: Buffer[];
  states: DeviceState[];
  errors: Array<{ code: string; message: string }>;
}

function createSession(): FakeSession {
  const messages: DeviceServerMessage[] = [];
  const audio: Buffer[] = [];
  const states: DeviceState[] = [];
  const errors: Array<{ code: string; message: string }> = [];

  return {
    deviceId: "device-1",
    userId: "user-1",
    messages,
    audio,
    states,
    errors,
    send: vi.fn((message: DeviceServerMessage) => {
      messages.push(message);
    }),
    sendAudio: vi.fn((chunk: Buffer) => {
      audio.push(chunk);
    }),
    setState: vi.fn((state: DeviceState) => {
      states.push(state);
    }),
    sendError: vi.fn((code, message) => {
      errors.push({ code, message });
    }),
  };
}

function transcript(text: string): TranscriptionResult {
  return { text, language: "en", provider: "local", durationMs: 500 };
}

function speech(text: string): SpeechResult {
  return {
    audio: Buffer.from(`audio:${text}`),
    codec: "pcm16",
    sampleRate: 16_000,
    provider: "piper",
    durationMs: 100,
  };
}

describe("voice turn pipeline", () => {
  it("transcribes, asks the agent, and streams sentence audio to the device", async () => {
    const transcribe = vi.fn(async () => transcript("What class is next?"));
    const reply = vi.fn(async () => ({
      text: "Your next class is Biology. It starts at nine.",
      voiceText: "Next is Biology at nine. Bring your lab coat.",
    }));
    const synthesize = vi.fn(async (text: string) => speech(text));
    const session = createSession();

    const handler = createVoiceTurnHandler({
      transcribe,
      reply,
      synthesize,
      getProfile: async () => ({ locale: "en", timezone: "UTC" }),
      logger: silentLogger,
    });

    await handler(turn, session);

    expect(transcribe).toHaveBeenCalledWith(turn, { language: "en" });
    expect(reply).toHaveBeenCalledWith("user-1", "What class is next?");
    expect(synthesize.mock.calls.map(call => call[0])).toEqual([
      "Next is Biology at nine.",
      "Bring your lab coat.",
    ]);

    expect(session.messages).toContainEqual({
      type: "transcript",
      turnId: "turn-1",
      text: "What class is next?",
      isFinal: true,
    });
    expect(session.messages.filter(message => message.type === "tts.start")).toHaveLength(2);
    expect(session.messages.filter(message => message.type === "tts.end")).toHaveLength(2);
    expect(session.audio.map(chunk => chunk.toString())).toEqual([
      "audio:Next is Biology at nine.",
      "audio:Bring your lab coat.",
    ]);
    expect(session.states).toEqual(["speaking", "speaking", "idle"]);
    expect(session.errors).toEqual([]);
  });

  it("logs VAD and first-audio stage timings", async () => {
    const info = vi.fn();
    const session = createSession();

    const handler = createVoiceTurnHandler({
      transcribe: async () => transcript("What is next?"),
      reply: async () => ({ text: "Biology is next." }),
      synthesize: async text => speech(text),
      getProfile: async () => ({ locale: "en", timezone: "UTC" }),
      logger: { info, warn: (): void => undefined, error: (): void => undefined },
    });

    await handler({ ...turn, vadMs: 14 }, session);

    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({
        vadMs: 14,
        timings: expect.objectContaining({
          firstTtsMs: expect.any(Number),
        }),
      }),
      "voice turn completed"
    );
  });

  it("speaks a fallback when no speech was recognized", async () => {
    const reply = vi.fn();
    const synthesize = vi.fn(async (text: string) => speech(text));
    const session = createSession();

    const handler = createVoiceTurnHandler({
      transcribe: async () => transcript("   "),
      reply,
      synthesize,
      getProfile: async () => ({ locale: "en", timezone: "UTC" }),
      logger: silentLogger,
    });

    await handler(turn, session);

    expect(reply).not.toHaveBeenCalled();
    expect(synthesize).toHaveBeenCalledWith(
      "Sorry, I did not catch that. Please try again.",
      { language: "en" }
    );
    expect(session.messages.some(message => message.type === "transcript")).toBe(false);
    expect(session.states.at(-1)).toBe("idle");
  });

  it("speaks a fallback when STT fails", async () => {
    const synthesize = vi.fn(async (text: string) => speech(text));
    const session = createSession();

    const handler = createVoiceTurnHandler({
      transcribe: async () => {
        throw new Error("STT_FAILED");
      },
      reply: async () => ({ text: "unused" }),
      synthesize,
      getProfile: async () => ({ locale: "en", timezone: "UTC" }),
      logger: silentLogger,
    });

    await handler(turn, session);

    expect(synthesize).toHaveBeenCalledWith(
      "Sorry, I did not catch that. Please try again.",
      { language: "en" }
    );
    expect(session.errors).toEqual([]);
    expect(session.states.at(-1)).toBe("idle");
  });

  it("speaks a fallback when the agent is unavailable", async () => {
    const synthesize = vi.fn(async (text: string) => speech(text));
    const session = createSession();

    const handler = createVoiceTurnHandler({
      transcribe: async () => transcript("What is next?"),
      reply: async () => {
        throw new Error("AI_PROVIDER_UNAVAILABLE");
      },
      synthesize,
      getProfile: async () => ({ locale: "en", timezone: "UTC" }),
      logger: silentLogger,
    });

    await handler(turn, session);

    expect(synthesize).toHaveBeenCalledWith(
      "Sorry, I could not reach your assistant. Please try again.",
      { language: "en" }
    );
    expect(session.states.at(-1)).toBe("idle");
  });

  it("speaks a bundled fallback when TTS is unavailable", async () => {
    const synthesize = vi.fn(async () => {
      throw new Error("TTS_FAILED");
    });
    const fallbackSpeech = vi.fn(async () => speech("fallback"));
    const session = createSession();

    const handler = createVoiceTurnHandler({
      transcribe: async () => transcript("What is next?"),
      reply: async () => ({ text: "Your next class is Biology." }),
      synthesize,
      fallbackSpeech,
      getProfile: async () => ({ locale: "en", timezone: "UTC" }),
      logger: silentLogger,
    });

    await handler(turn, session);

    expect(synthesize).toHaveBeenCalledOnce();
    expect(fallbackSpeech).toHaveBeenCalledOnce();
    expect(session.errors).toEqual([]);
    expect(session.audio.map(chunk => chunk.toString())).toEqual(["audio:fallback"]);
    expect(session.messages.filter(message => message.type === "tts.start")).toHaveLength(1);
    expect(session.states.at(-1)).toBe("idle");
  });

  it("stops streaming when the device starts a newer turn", async () => {
    let active = true;
    const session = createSession();
    session.isTurnActive = (turnId): boolean =>
      active && turnId === "turn-1";

    const chunk = Buffer.alloc(4 * 1024);
    session.sendAudio = vi.fn((audio: Buffer) => {
      session.audio.push(audio);
      active = false;
    });

    const handler = createVoiceTurnHandler({
      transcribe: async () => transcript("Tell me a long story."),
      reply: async () => ({ text: "Once upon a time there was a robot." }),
      synthesize: async () => ({
        audio: Buffer.concat([chunk, chunk, chunk]),
        codec: "pcm16",
        sampleRate: 16_000,
        provider: "piper",
        durationMs: 300,
      }),
      getProfile: async () => ({ locale: "en", timezone: "UTC" }),
      logger: silentLogger,
    });

    await handler(turn, session);

    expect(session.audio).toHaveLength(1);
    expect(session.messages.filter(message => message.type === "tts.end")).toHaveLength(0);
    expect(session.states).toEqual(["speaking"]);
    expect(session.errors).toEqual([]);
  });

  it("falls back to English when the profile cannot be loaded", async () => {
    const transcribe = vi.fn(async () => transcript("Hello"));
    const session = createSession();

    const handler = createVoiceTurnHandler({
      transcribe,
      reply: async () => ({ text: "Hi." }),
      synthesize: async (text: string) => speech(text),
      getProfile: async () => {
        throw new Error("USER_NOT_FOUND");
      },
      logger: silentLogger,
    });

    await handler(turn, session);

    expect(transcribe).toHaveBeenCalledWith(turn, { language: "en" });
  });

  it("synthesizes streamed sentences before the agent reply finishes", async () => {
    let releaseSecond!: () => void;
    const secondReady = new Promise<void>(resolve => {
      releaseSecond = resolve;
    });
    const synthesize = vi.fn(async (text: string) => {
      if (text === "First sentence.") {
        releaseSecond();
      }
      return speech(text);
    });
    const replyStream = vi.fn(
      async (
        _userId: string,
        _text: string,
        options: VoiceReplyStreamOptions
      ) => {
        options.onToken("First sentence. ");
        await secondReady;
        options.onToken("Second sentence.");
        return {
          text: "First sentence. Second sentence.",
          voiceText: "First sentence. Second sentence.",
        };
      }
    );
    const session = createSession();

    const handler = createVoiceTurnHandler({
      transcribe: async () => transcript("Tell me what is next."),
      replyStream,
      synthesize,
      getProfile: async () => ({ locale: "en", timezone: "UTC" }),
      logger: silentLogger,
    });

    await handler(turn, session);

    expect(replyStream).toHaveBeenCalledOnce();
    expect(synthesize.mock.calls.map(call => call[0])).toEqual([
      "First sentence.",
      "Second sentence.",
    ]);
    expect(session.states.at(-1)).toBe("idle");
    expect(session.errors).toEqual([]);
  });

  it("caps streamed speech at two sentences", async () => {
    const synthesize = vi.fn(async (text: string) => speech(text));
    const replyStream = vi.fn(
      async (
        _userId: string,
        _text: string,
        options: VoiceReplyStreamOptions
      ) => {
        options.onToken("One. Two. Three.");
        return { text: "One. Two. Three." };
      }
    );
    const session = createSession();

    const handler = createVoiceTurnHandler({
      transcribe: async () => transcript("Count."),
      replyStream,
      synthesize,
      getProfile: async () => ({ locale: "en", timezone: "UTC" }),
      logger: silentLogger,
    });

    await handler(turn, session);

    expect(synthesize.mock.calls.map(call => call[0])).toEqual([
      "One.",
      "Two.",
    ]);
    expect(session.states.at(-1)).toBe("idle");
  });
});
