import type { IncomingMessage, Server as HttpServer } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer, type RawData } from "ws";
import type { AuthenticatedDevice } from "@robo/shared/devices";
import {
  DEVICE_AUDIO_MAX_BYTES,
  DEVICE_AUDIO_TURN_TIMEOUT_MS,
  DEVICE_HEARTBEAT_INTERVAL_MS,
  DEVICE_WS_PATH,
  deviceClientMessageSchema,
  type AudioCodec,
  type DeviceAudioTurn,
  type DeviceAudioTurnHandler,
  type DeviceClientMessage,
  type DeviceServerMessage,
  type DeviceSession,
  type DeviceState,
  type GatewayErrorCode,
} from "@robo/shared/realtime";
import type { VadDetector, VadTurn } from "./vad";

export interface RealtimeLogger {
  info: (payload: unknown, message?: string) => void;
  warn: (payload: unknown, message?: string) => void;
  error: (payload: unknown, message?: string) => void;
  debug: (payload: unknown, message?: string) => void;
}

export interface DeviceGatewayOptions {
  authenticateDevice: (
    deviceId: string,
    token: string,
    metadata: { firmwareVersion?: string; locale?: string }
  ) => Promise<AuthenticatedDevice>;
  onAudioTurn?: DeviceAudioTurnHandler;
  onDisconnect?: (deviceId: string) => Promise<void> | void;
  onHeartbeat?: (deviceId: string) => Promise<void> | void;
  heartbeatIntervalMs?: number;
  helloTimeoutMs?: number;
  audioTurnTimeoutMs?: number;
  maxAudioBytes?: number;
  vad?: VadDetector;
  logger?: RealtimeLogger;
}

interface AudioTurn {
  id: string;
  codec: AudioCodec;
  sampleRate: number;
  chunks: Buffer[];
  bytes: number;
  startedAt: number;
  vadMs: number;
  timeout: NodeJS.Timeout;
}

const AUTH_CLOSE_CODE = 4001;
const INTERNAL_CLOSE_CODE = 1011;
const LAST_SEEN_PERSIST_INTERVAL_MS = 60_000;

const noopLogger: RealtimeLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
};

function toBuffer(data: RawData): Buffer {
  if (Buffer.isBuffer(data)) {
    return data;
  }

  if (Array.isArray(data)) {
    return Buffer.concat(data);
  }

  return Buffer.from(data);
}

class DeviceConnection {
  readonly socket: WebSocket;
  private readonly gateway: DeviceGateway;
  private readonly helloTimeoutMs: number;
  private readonly audioTurnTimeoutMs: number;
  private readonly maxAudioBytes: number;
  private device: AuthenticatedDevice | null = null;
  private turn: AudioTurn | null = null;
  private processingTurnId: string | null = null;
  private readonly cancelledTurnIds = new Set<string>();
  private readonly completedTurnIds = new Set<string>();
  private readonly vad: VadDetector | null;
  private activeVad: VadTurn | null = null;
  private vadQueue: Promise<void> = Promise.resolve();
  private ignoreAudioUntil = 0;
  private state: DeviceState = "idle";
  private alive = true;
  private lastSeenPersistedAt = 0;
  private helloTimeout: NodeJS.Timeout | null = null;
  private closed = false;

  constructor(
    socket: WebSocket,
    gateway: DeviceGateway,
    options: {
      helloTimeoutMs: number;
      audioTurnTimeoutMs: number;
      maxAudioBytes: number;
      vad?: VadDetector;
    }
  ) {
    this.socket = socket;
    this.gateway = gateway;
    this.helloTimeoutMs = options.helloTimeoutMs;
    this.audioTurnTimeoutMs = options.audioTurnTimeoutMs;
    this.maxAudioBytes = options.maxAudioBytes;
    this.vad = options.vad ?? null;

    this.helloTimeout = setTimeout(() => {
      this.fail(
        "HELLO_TIMEOUT",
        "The device did not authenticate in time",
        AUTH_CLOSE_CODE
      );
    }, this.helloTimeoutMs);
    this.helloTimeout.unref();

    socket.on("message", (data, isBinary) => {
      void this.handleMessage(data, isBinary);
    });
    socket.on("pong", () => {
      this.alive = true;
      this.markSeen();
    });
    socket.on("error", error => {
      this.gateway.log.warn(
        { err: error, deviceId: this.device?.device.deviceId },
        "device websocket error"
      );
    });
    socket.on("close", (code, reason) => {
      void this.handleClose(code, reason.toString());
    });
  }

  get deviceId(): string | undefined {
    return this.device?.device.deviceId;
  }

  ping(): boolean {
    if (this.closed) {
      return false;
    }

    if (!this.alive) {
      this.gateway.log.warn(
        { deviceId: this.deviceId },
        "device missed heartbeat; terminating connection"
      );
      this.socket.terminate();
      return false;
    }

    this.alive = false;
    this.socket.ping();
    return true;
  }

  async persistLastSeenIfDue(): Promise<void> {
    if (!this.device) {
      return;
    }

    const now = Date.now();
    if (now - this.lastSeenPersistedAt < LAST_SEEN_PERSIST_INTERVAL_MS) {
      return;
    }

    this.lastSeenPersistedAt = now;
    await this.gateway.touchPresence(this.device.device.deviceId);
  }

  private markSeen(): void {
    if (this.device) {
      this.lastSeenPersistedAt = 0;
    }
  }

  private isTurnActive(turnId: string): boolean {
    return (
      this.processingTurnId === turnId && !this.cancelledTurnIds.has(turnId)
    );
  }

  private session(): DeviceSession {
    const device = this.device;

    if (!device) {
      throw new Error("DEVICE_NOT_AUTHENTICATED");
    }

    return {
      deviceId: device.device.deviceId,
      userId: device.userId,
      send: message => this.send(message),
      sendAudio: (chunk): void => {
        if (this.socket.readyState === WebSocket.OPEN) {
          this.socket.send(chunk, { binary: true });
        }
      },
      setState: (state, turnId) => this.setState(state, turnId),
      sendError: (code, message, turnId) => this.sendError(code, message, turnId),
      isTurnActive: turnId => this.isTurnActive(turnId),
    };
  }

  private async handleMessage(data: RawData, isBinary: boolean): Promise<void> {
    if (this.closed) {
      return;
    }

    this.markSeen();

    if (isBinary) {
      this.handleAudioChunk(toBuffer(data));
      return;
    }

    let raw: unknown;
    try {
      raw = JSON.parse(toBuffer(data).toString("utf8"));
    } catch {
      this.sendError("INVALID_MESSAGE", "Message is not valid JSON");
      return;
    }

    const parsed = deviceClientMessageSchema.safeParse(raw);
    if (!parsed.success) {
      this.sendError("INVALID_MESSAGE", "Message does not match the device protocol");
      return;
    }

    await this.handleClientMessage(parsed.data);
  }

  private async handleClientMessage(message: DeviceClientMessage): Promise<void> {
    if (message.type === "hello") {
      await this.handleHello(message);
      return;
    }

    if (!this.device) {
      this.fail("HELLO_REQUIRED", "Authenticate with hello before sending messages", AUTH_CLOSE_CODE);
      return;
    }

    switch (message.type) {
      case "audio.start":
        this.handleAudioStart(message.turnId, message.codec, message.sampleRate);
        break;
      case "audio.end":
        await this.handleAudioEnd(message.turnId);
        break;
      case "heartbeat":
        this.markSeen();
        break;
      case "button":
        this.gateway.log.debug(
          { deviceId: this.deviceId, button: message.name, state: message.state },
          "device button event"
        );
        break;
      case "status":
        this.gateway.log.debug(
          { deviceId: this.deviceId, status: message },
          "device status event"
        );
        break;
    }
  }

  private async handleHello(message: Extract<DeviceClientMessage, { type: "hello" }>): Promise<void> {
    if (this.device) {
      this.sendError("ALREADY_AUTHENTICATED", "The device is already authenticated");
      return;
    }

    try {
      const authenticated = await this.gateway.authenticateDevice(
        message.deviceId,
        message.token,
        {
          firmwareVersion: message.firmwareVersion,
          locale: message.locale,
        }
      );

      if (this.closed) {
        await this.gateway.handleDisconnect(authenticated.device.deviceId);
        return;
      }

      this.device = authenticated;
      if (this.helloTimeout) {
        clearTimeout(this.helloTimeout);
        this.helloTimeout = null;
      }

      this.lastSeenPersistedAt = Date.now();
      this.setState("idle");
      this.gateway.log.info(
        { deviceId: message.deviceId, userId: authenticated.userId },
        "device connected"
      );
    } catch (error) {
      const code: GatewayErrorCode =
        error instanceof Error && error.message === "DEVICE_REVOKED"
          ? "DEVICE_REVOKED"
          : "DEVICE_UNAUTHORIZED";

      this.gateway.log.warn(
        { deviceId: message.deviceId, code },
        "device authentication failed"
      );
      this.fail(code, "Device authentication failed", AUTH_CLOSE_CODE);
    }
  }

  private handleAudioStart(turnId: string, codec: AudioCodec, sampleRate: number): void {
    if (this.processingTurnId && this.processingTurnId !== turnId) {
      this.cancelledTurnIds.add(this.processingTurnId);
      this.gateway.log.info(
        {
          deviceId: this.deviceId,
          previousTurnId: this.processingTurnId,
          turnId,
        },
        "new audio turn cancelled the previous reply"
      );
    }

    if (this.turn) {
      clearTimeout(this.turn.timeout);
      this.gateway.log.info(
        { deviceId: this.deviceId, previousTurnId: this.turn.id, turnId },
        "new audio turn cancelled the previous turn"
      );
      this.rememberCompletedTurn(this.turn.id);
      this.turn = null;
    }

    this.completedTurnIds.delete(turnId);
    this.activeVad = null;
    this.ignoreAudioUntil = Date.now() + 2_000;

    const timeout = setTimeout(() => {
      if (!this.turn || this.turn.id !== turnId) {
        return;
      }

      this.turn = null;
      this.activeVad = null;
      this.rememberCompletedTurn(turnId);
      this.ignoreAudioUntil = Date.now() + 2_000;
      this.sendError("AUDIO_TIMEOUT", "Audio turn timed out", turnId);
      this.setState("idle", turnId);
    }, this.audioTurnTimeoutMs);
    timeout.unref();

    this.turn = {
      id: turnId,
      codec,
      sampleRate,
      chunks: [],
      bytes: 0,
      startedAt: Date.now(),
      vadMs: 0,
      timeout,
    };

    if (codec === "pcm16") {
      this.activeVad = this.vad?.startTurn(sampleRate) ?? null;
    }

    this.setState("listening", turnId);
  }

  private handleAudioChunk(chunk: Buffer): void {
    if (!this.device) {
      return;
    }

    if (!this.turn) {
      if (Date.now() < this.ignoreAudioUntil) {
        return;
      }

      this.sendError("AUDIO_TURN_NOT_STARTED", "Send audio.start before binary audio frames");
      return;
    }

    if (chunk.length === 0) {
      return;
    }

    this.turn.chunks.push(chunk);
    this.turn.bytes += chunk.length;

    if (this.turn.bytes > this.maxAudioBytes) {
      const turnId = this.turn.id;
      clearTimeout(this.turn.timeout);
      this.turn = null;
      this.activeVad = null;
      this.rememberCompletedTurn(turnId);
      this.ignoreAudioUntil = Date.now() + 2_000;
      this.sendError("AUDIO_TOO_LARGE", "Audio turn exceeded the size limit", turnId);
      this.setState("idle", turnId);
      return;
    }

    this.enqueueVad(chunk);
  }

  private enqueueVad(chunk: Buffer): void {
    if (!this.turn || !this.activeVad) {
      return;
    }

    const turnId = this.turn.id;
    const vad = this.activeVad;

    this.vadQueue = this.vadQueue
      .then(async () => {
        if (!this.turn || this.turn.id !== turnId) {
          return;
        }

        const vadStartedAt = Date.now();
        const ended = await vad.push(chunk);
        if (this.turn?.id === turnId) {
          this.turn.vadMs += Date.now() - vadStartedAt;
        }

        if (ended) {
          await this.finalizeTurn(turnId);
        }
      })
      .catch(error => {
        this.gateway.log.warn(
          { err: error, deviceId: this.deviceId, turnId },
          "silero vad failed"
        );
      });
  }

  private rememberCompletedTurn(turnId: string): void {
    this.completedTurnIds.add(turnId);
    if (this.completedTurnIds.size > 8) {
      const oldest = this.completedTurnIds.values().next().value;
      if (oldest) {
        this.completedTurnIds.delete(oldest);
      }
    }
  }

  private async handleAudioEnd(turnId: string): Promise<void> {
    if (!this.turn) {
      if (this.completedTurnIds.has(turnId)) {
        return;
      }

      this.sendError("AUDIO_TURN_NOT_STARTED", "No active audio turn", turnId);
      return;
    }

    if (this.turn.id !== turnId) {
      this.sendError(
        "AUDIO_TURN_ID_MISMATCH",
        "audio.end does not match the active turn",
        turnId
      );
      return;
    }

    await this.finalizeTurn(turnId);
  }

  private async finalizeTurn(turnId: string): Promise<void> {
    if (!this.turn || this.turn.id !== turnId) {
      return;
    }

    const turn = this.turn;
    clearTimeout(turn.timeout);
    this.turn = null;
    this.activeVad = null;
    this.rememberCompletedTurn(turn.id);
    this.ignoreAudioUntil = Date.now() + 2_000;
    this.setState("thinking", turn.id);

    const device = this.device;
    if (!device) {
      this.sendError("DEVICE_UNAUTHORIZED", "The device is no longer authenticated", turn.id);
      this.setState("idle", turn.id);
      return;
    }

    const audioTurn: DeviceAudioTurn = {
      turnId: turn.id,
      userId: device.userId,
      deviceId: device.device.deviceId,
      codec: turn.codec,
      sampleRate: turn.sampleRate,
      audio: Buffer.concat(turn.chunks, turn.bytes),
      durationMs: Date.now() - turn.startedAt,
      receivedAt: new Date(),
      vadMs: turn.vadMs,
    };

    const startedAt = Date.now();
    this.processingTurnId = turn.id;

    try {
      await this.gateway.processAudioTurn(audioTurn, this.session());
      this.gateway.log.info(
        {
          deviceId: audioTurn.deviceId,
          turnId: audioTurn.turnId,
          bytes: audioTurn.audio.length,
          durationMs: audioTurn.durationMs,
          vadMs: audioTurn.vadMs,
          processingMs: Date.now() - startedAt,
        },
        "device audio turn processed"
      );
    } catch (error) {
      this.gateway.log.error(
        { err: error, deviceId: audioTurn.deviceId, turnId: audioTurn.turnId },
        "device audio turn failed"
      );
      this.sendError("INTERNAL_ERROR", "The voice request could not be processed", turn.id);
    } finally {
      const active = this.isTurnActive(turn.id);
      if (this.state === "thinking" && active) {
        this.setState("idle", turn.id);
      }
      if (this.processingTurnId === turn.id) {
        this.processingTurnId = null;
      }
      this.cancelledTurnIds.delete(turn.id);
    }
  }

  private setState(state: DeviceState, turnId?: string): void {
    this.state = state;
    this.send({ type: "state", state, ...(turnId ? { turnId } : {}) });
  }

  private sendError(code: GatewayErrorCode, message: string, turnId?: string): void {
    this.send({ type: "error", code, message, ...(turnId ? { turnId } : {}) });
  }

  private send(message: DeviceServerMessage): void {
    if (this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(JSON.stringify(message));
  }

  private fail(code: GatewayErrorCode, message: string, closeCode: number): void {
    if (this.closed) {
      return;
    }

    this.sendError(code, message);
    this.socket.close(closeCode, code);
  }

  private async handleClose(code: number, reason: string): Promise<void> {
    if (this.closed) {
      return;
    }

    this.closed = true;
    if (this.helloTimeout) {
      clearTimeout(this.helloTimeout);
      this.helloTimeout = null;
    }
    if (this.turn) {
      clearTimeout(this.turn.timeout);
      this.turn = null;
    }
    this.activeVad = null;
    if (this.processingTurnId) {
      this.cancelledTurnIds.add(this.processingTurnId);
      this.processingTurnId = null;
    }

    const device = this.device;
    this.device = null;

    if (device) {
      this.gateway.log.info(
        { deviceId: device.device.deviceId, code, reason },
        "device disconnected"
      );

      try {
        await this.gateway.handleDisconnect(device.device.deviceId);
      } catch (error) {
        this.gateway.log.warn(
          { err: error, deviceId: device.device.deviceId },
          "failed to update device presence"
        );
      }
    }

    this.gateway.removeConnection(this.socket);
  }
}

export class DeviceGateway {
  readonly log: RealtimeLogger;
  private readonly wss: WebSocketServer;
  private readonly server: HttpServer;
  private readonly options: Required<
    Pick<DeviceGatewayOptions, "heartbeatIntervalMs" | "helloTimeoutMs" | "audioTurnTimeoutMs" | "maxAudioBytes">
  > &
    DeviceGatewayOptions;
  private readonly connections = new Map<WebSocket, DeviceConnection>();
  private heartbeat: NodeJS.Timeout | null = null;
  private closed = false;
  private readonly onUpgrade: (req: IncomingMessage, socket: Duplex, head: Buffer) => void;

  constructor(server: HttpServer, options: DeviceGatewayOptions) {
    this.server = server;
    this.options = {
      ...options,
      heartbeatIntervalMs: options.heartbeatIntervalMs ?? DEVICE_HEARTBEAT_INTERVAL_MS,
      helloTimeoutMs: options.helloTimeoutMs ?? 10_000,
      audioTurnTimeoutMs: options.audioTurnTimeoutMs ?? DEVICE_AUDIO_TURN_TIMEOUT_MS,
      maxAudioBytes: options.maxAudioBytes ?? DEVICE_AUDIO_MAX_BYTES,
    };
    this.log = options.logger ?? noopLogger;

    this.wss = new WebSocketServer({
      noServer: true,
      maxPayload: this.options.maxAudioBytes + 64 * 1024,
    });

    this.wss.on("connection", (socket): void => this.accept(socket));

    this.onUpgrade = (req, socket, head): void => {
      const pathname = this.pathname(req);
      if (pathname !== DEVICE_WS_PATH) {
        return;
      }

      this.wss.handleUpgrade(req, socket, head, ws => {
        this.wss.emit("connection", ws, req);
      });
    };

    this.server.on("upgrade", this.onUpgrade);
    this.startHeartbeat();
  }

  async authenticateDevice(
    deviceId: string,
    token: string,
    metadata: { firmwareVersion?: string; locale?: string }
  ): Promise<AuthenticatedDevice> {
    return this.options.authenticateDevice(deviceId, token, metadata);
  }

  async processAudioTurn(turn: DeviceAudioTurn, session: DeviceSession): Promise<void> {
    if (!this.options.onAudioTurn) {
      session.sendError(
        "VOICE_PIPELINE_NOT_READY",
        "The voice pipeline is not configured yet",
        turn.turnId
      );
      return;
    }

    await this.options.onAudioTurn(turn, session);
  }

  async handleDisconnect(deviceId: string): Promise<void> {
    if (this.options.onDisconnect) {
      await this.options.onDisconnect(deviceId);
    }
  }

  async touchPresence(deviceId: string): Promise<void> {
    if (this.options.onHeartbeat) {
      await this.options.onHeartbeat(deviceId);
    }
  }

  removeConnection(socket: WebSocket): void {
    this.connections.delete(socket);
  }

  get size(): number {
    return this.connections.size;
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }

    this.closed = true;
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }

    this.server.off("upgrade", this.onUpgrade);

    for (const client of this.wss.clients) {
      client.close(1001, "server shutting down");
    }

    const forceClose = setTimeout(() => {
      for (const client of this.wss.clients) {
        client.terminate();
      }
    }, 1_000);
    forceClose.unref();

    await new Promise<void>(resolve => {
      this.wss.close(() => resolve());
    });
    clearTimeout(forceClose);
    this.connections.clear();
  }

  private accept(socket: WebSocket): void {
    if (this.closed) {
      socket.close(INTERNAL_CLOSE_CODE, "gateway closed");
      return;
    }

    const connection = new DeviceConnection(socket, this, {
      helloTimeoutMs: this.options.helloTimeoutMs,
      audioTurnTimeoutMs: this.options.audioTurnTimeoutMs,
      maxAudioBytes: this.options.maxAudioBytes,
      vad: this.options.vad,
    });
    this.connections.set(socket, connection);
  }

  private startHeartbeat(): void {
    this.heartbeat = setInterval(() => {
      for (const connection of this.connections.values()) {
        const alive = connection.ping();
        if (alive) {
          void connection.persistLastSeenIfDue();
        }
      }
    }, this.options.heartbeatIntervalMs);
    this.heartbeat.unref();
  }

  private pathname(req: IncomingMessage): string | null {
    try {
      return new URL(req.url ?? "/", "http://localhost").pathname;
    } catch {
      return null;
    }
  }
}
