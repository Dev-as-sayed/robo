import { z } from "zod";

export const DEVICE_WS_PATH = "/ws/device";
export const DEVICE_PROTOCOL_VERSION = 1;
export const DEVICE_HEARTBEAT_INTERVAL_MS = 30_000;
export const DEVICE_AUDIO_TURN_TIMEOUT_MS = 15_000;
export const DEVICE_AUDIO_MAX_BYTES = 2 * 1024 * 1024;

export const audioCodecSchema = z.enum(["pcm16", "opus"]);

export const deviceHelloSchema = z.object({
  type: z.literal("hello"),
  protocolVersion: z.number().int().min(1).max(DEVICE_PROTOCOL_VERSION).default(1),
  deviceId: z.string().trim().min(3).max(100),
  token: z.string().min(16).max(512),
  firmwareVersion: z.string().trim().max(50).optional(),
  locale: z.string().trim().min(2).max(10).optional(),
});

export const audioStartSchema = z.object({
  type: z.literal("audio.start"),
  codec: audioCodecSchema.default("pcm16"),
  sampleRate: z.number().int().min(8_000).max(48_000).default(16_000),
  turnId: z.string().trim().min(1).max(64),
});

export const audioEndSchema = z.object({
  type: z.literal("audio.end"),
  turnId: z.string().trim().min(1).max(64),
});

export const deviceHeartbeatSchema = z.object({
  type: z.literal("heartbeat"),
  at: z.string().datetime().optional(),
});

export const deviceButtonSchema = z.object({
  type: z.literal("button"),
  name: z.enum(["talk", "mute", "study"]),
  state: z.enum(["pressed", "released"]),
});

export const deviceStatusSchema = z.object({
  type: z.literal("status"),
  wifiRssi: z.number().int().min(-120).max(0).optional(),
  uptimeMs: z.number().int().nonnegative().optional(),
  battery: z.number().min(0).max(100).optional(),
});

export const deviceClientMessageSchema = z.discriminatedUnion("type", [
  deviceHelloSchema,
  audioStartSchema,
  audioEndSchema,
  deviceHeartbeatSchema,
  deviceButtonSchema,
  deviceStatusSchema,
]);

export const deviceStateSchema = z.enum([
  "idle",
  "listening",
  "thinking",
  "speaking",
  "error",
]);

export const gatewayErrorCodeSchema = z.enum([
  "HELLO_TIMEOUT",
  "HELLO_REQUIRED",
  "ALREADY_AUTHENTICATED",
  "INVALID_MESSAGE",
  "PROTOCOL_VERSION_UNSUPPORTED",
  "DEVICE_UNAUTHORIZED",
  "DEVICE_REVOKED",
  "AUDIO_TURN_NOT_STARTED",
  "AUDIO_TURN_ID_MISMATCH",
  "AUDIO_TOO_LARGE",
  "AUDIO_TIMEOUT",
  "VOICE_PIPELINE_NOT_READY",
  "INTERNAL_ERROR",
]);

export interface ServerStateMessage {
  type: "state";
  state: z.infer<typeof deviceStateSchema>;
  turnId?: string;
}

export interface ServerTranscriptMessage {
  type: "transcript";
  turnId: string;
  text: string;
  isFinal?: boolean;
}

export interface ServerTtsStartMessage {
  type: "tts.start";
  turnId: string;
  codec: z.infer<typeof audioCodecSchema>;
  sampleRate: number;
}

export interface ServerTtsEndMessage {
  type: "tts.end";
  turnId: string;
}

export interface ServerErrorMessage {
  type: "error";
  code: z.infer<typeof gatewayErrorCodeSchema>;
  message: string;
  turnId?: string;
}

export type DeviceServerMessage =
  | ServerStateMessage
  | ServerTranscriptMessage
  | ServerTtsStartMessage
  | ServerTtsEndMessage
  | ServerErrorMessage;

export type DeviceHello = z.infer<typeof deviceHelloSchema>;
export type AudioStart = z.infer<typeof audioStartSchema>;
export type AudioEnd = z.infer<typeof audioEndSchema>;
export type DeviceClientMessage = z.infer<typeof deviceClientMessageSchema>;
export type DeviceState = z.infer<typeof deviceStateSchema>;
export type AudioCodec = z.infer<typeof audioCodecSchema>;
export type GatewayErrorCode = z.infer<typeof gatewayErrorCodeSchema>;

export interface DeviceAudioTurn {
  turnId: string;
  userId: string;
  deviceId: string;
  codec: AudioCodec;
  sampleRate: number;
  audio: Buffer;
  durationMs: number;
  receivedAt: Date;
  vadMs?: number;
}

export interface DeviceSession {
  deviceId: string;
  userId: string;
  send: (message: DeviceServerMessage) => void;
  sendAudio: (chunk: Buffer) => void;
  setState: (state: DeviceState, turnId?: string) => void;
  sendError: (code: GatewayErrorCode, message: string, turnId?: string) => void;
  /** False once the device starts a newer turn or disconnects. */
  isTurnActive?: (turnId: string) => boolean;
}

export type DeviceAudioTurnHandler = (
  turn: DeviceAudioTurn,
  session: DeviceSession
) => Promise<void> | void;
