import type {
  DeviceAudioTurn,
  DeviceAudioTurnHandler,
  DeviceSession,
} from "@robo/shared/realtime";
import { getMe } from "@robo/shared/users";
import logger from "../../lib/logger";
import { sendChatMessage } from "../ai/chat-service";
import { splitSentences } from "./sentence-splitter";
import { transcribeAudio, type TranscriptionResult } from "./stt";
import { synthesizeSpeech, type SpeechResult } from "./tts";

interface VoiceProfile {
  locale: string;
  timezone: string;
}

interface VoiceReply {
  text: string;
  voiceText?: string | null;
}

interface PipelineLogger {
  info: (payload: unknown, message?: string) => void;
  warn: (payload: unknown, message?: string) => void;
  error: (payload: unknown, message?: string) => void;
}

export interface VoicePipelineDeps {
  transcribe?: (
    turn: DeviceAudioTurn,
    options: { language: string }
  ) => Promise<TranscriptionResult>;
  reply?: (userId: string, text: string) => Promise<VoiceReply>;
  synthesize?: (
    text: string,
    options: { language: string }
  ) => Promise<SpeechResult>;
  getProfile?: (userId: string) => Promise<VoiceProfile>;
  logger?: PipelineLogger;
}

const conversations = new Map<string, string>();
const MAX_TRACKED_CONVERSATIONS = 1_000;
const AUDIO_CHUNK_BYTES = 4 * 1024;

function rememberConversation(userId: string, conversationId: string): void {
  conversations.delete(userId);
  conversations.set(userId, conversationId);

  if (conversations.size > MAX_TRACKED_CONVERSATIONS) {
    const oldest = conversations.keys().next().value;
    if (oldest) {
      conversations.delete(oldest);
    }
  }
}

async function defaultReply(userId: string, text: string): Promise<VoiceReply> {
  const conversationId = conversations.get(userId);

  try {
    const result = await sendChatMessage(userId, {
      content: text,
      channel: "device",
      ...(conversationId ? { conversationId } : {}),
    });

    rememberConversation(userId, result.conversation.id);
    return {
      text: result.assistantMessage.content,
      voiceText: result.assistantMessage.voiceText,
    };
  } catch (error) {
    if (
      conversationId &&
      error instanceof Error &&
      error.message === "CONVERSATION_NOT_FOUND"
    ) {
      conversations.delete(userId);
      const result = await sendChatMessage(userId, {
        content: text,
        channel: "device",
      });

      rememberConversation(userId, result.conversation.id);
      return {
        text: result.assistantMessage.content,
        voiceText: result.assistantMessage.voiceText,
      };
    }

    throw error;
  }
}

async function defaultProfile(userId: string): Promise<VoiceProfile> {
  const user = await getMe(userId);
  return { locale: user.locale, timezone: user.timezone };
}

function failureSpeech(error: unknown): string {
  if (error instanceof Error && error.message.startsWith("STT_")) {
    return "Sorry, I did not catch that. Please try again.";
  }

  if (error instanceof Error && error.message.startsWith("AI_")) {
    return "Sorry, I could not reach your assistant. Please try again.";
  }

  return "Sorry, something went wrong. Please try again.";
}

async function speak(
  text: string,
  turn: DeviceAudioTurn,
  session: DeviceSession,
  language: string,
  synthesize: NonNullable<VoicePipelineDeps["synthesize"]>
): Promise<void> {
  const speech = await synthesize(text, { language });
  session.setState("speaking", turn.turnId);
  session.send({
    type: "tts.start",
    turnId: turn.turnId,
    codec: speech.codec,
    sampleRate: speech.sampleRate,
  });

  if (speech.codec === "pcm16") {
    for (let offset = 0; offset < speech.audio.length; offset += AUDIO_CHUNK_BYTES) {
      session.sendAudio(speech.audio.subarray(offset, offset + AUDIO_CHUNK_BYTES));
    }
  } else {
    session.sendAudio(speech.audio);
  }

  session.send({ type: "tts.end", turnId: turn.turnId });
}

export function createVoiceTurnHandler(
  deps: VoicePipelineDeps = {}
): DeviceAudioTurnHandler {
  const transcribe =
    deps.transcribe ??
    ((turn, options): Promise<TranscriptionResult> =>
      transcribeAudio(turn, { language: options.language }));
  const reply = deps.reply ?? defaultReply;
  const synthesize =
    deps.synthesize ??
    ((text, options): Promise<SpeechResult> =>
      synthesizeSpeech(text, { language: options.language }));
  const getProfile = deps.getProfile ?? defaultProfile;
  const log = deps.logger ?? logger;

  return async (turn, session) => {
    const startedAt = Date.now();
    const timings = { sttMs: 0, agentMs: 0, ttsMs: 0 };
    let profile: VoiceProfile = { locale: "en", timezone: "UTC" };

    try {
      profile = await getProfile(turn.userId);
    } catch (error) {
      log.warn({ err: error, userId: turn.userId }, "failed to load voice profile");
    }

    try {
      const transcription = await transcribe(turn, { language: profile.locale });
      timings.sttMs = Date.now() - startedAt;
      const transcriptText = transcription.text.trim();

      if (!transcriptText) {
        await speak(
          "Sorry, I did not catch that. Please try again.",
          turn,
          session,
          profile.locale,
          synthesize
        );
        return;
      }

      session.send({
        type: "transcript",
        turnId: turn.turnId,
        text: transcriptText,
        isFinal: true,
      });

      const agentStartedAt = Date.now();
      const response = await reply(turn.userId, transcriptText);
      timings.agentMs = Date.now() - agentStartedAt;

      const spokenText = (response.voiceText?.trim() || response.text).trim();
      if (!spokenText) {
        throw new Error("AI_EMPTY_RESPONSE");
      }

      const ttsStartedAt = Date.now();
      const sentences = splitSentences(spokenText);

      for (const sentence of sentences.length > 0 ? sentences : [spokenText]) {
        await speak(sentence, turn, session, profile.locale, synthesize);
      }

      timings.ttsMs = Date.now() - ttsStartedAt;
      log.info(
        {
          userId: turn.userId,
          deviceId: turn.deviceId,
          turnId: turn.turnId,
          transcriptionProvider: transcription.provider,
          audioMs: turn.durationMs,
          timings,
          totalMs: Date.now() - startedAt,
        },
        "voice turn completed"
      );
    } catch (error) {
      log.error(
        { err: error, userId: turn.userId, turnId: turn.turnId, timings },
        "voice turn failed"
      );

      if (error instanceof Error && error.message.startsWith("TTS_")) {
        session.sendError(
          "INTERNAL_ERROR",
          "The voice reply could not be generated",
          turn.turnId
        );
        return;
      }

      try {
        await speak(
          failureSpeech(error),
          turn,
          session,
          profile.locale,
          synthesize
        );
      } catch (fallbackError) {
        log.error(
          { err: fallbackError, userId: turn.userId, turnId: turn.turnId },
          "voice fallback failed"
        );
        session.sendError(
          "INTERNAL_ERROR",
          "The voice reply could not be generated",
          turn.turnId
        );
      }
    } finally {
      session.setState("idle", turn.turnId);
    }
  };
}
