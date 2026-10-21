import { createServer, type Server } from "node:http";
import WebSocket from "ws";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedDevice } from "@robo/shared/devices";
import type {
  DeviceAudioTurn,
  DeviceServerMessage,
  DeviceSession,
} from "@robo/shared/realtime";
import {
  DeviceGateway,
  type DeviceGatewayOptions,
  type RealtimeLogger,
} from "../src/modules/realtime/gateway";

const DEVICE_TOKEN = "valid-device-token-1234567890";

const silentLogger: RealtimeLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
};

const authenticatedDevice: AuthenticatedDevice = {
  userId: "user-1",
  device: {
    id: "device-db-1",
    deviceId: "device-1",
    name: "Desk robot",
    firmwareVersion: "0.1.0",
    locale: "en",
    status: "ONLINE",
    lastSeenAt: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  },
};

class TestClient {
  readonly socket: WebSocket;
  readonly closed: Promise<number>;
  private readonly messages: DeviceServerMessage[] = [];
  private readonly audioChunks: Buffer[] = [];
  private readonly waiters: Array<(message: DeviceServerMessage) => void> = [];
  private readonly audioWaiters: Array<(chunk: Buffer) => void> = [];

  private constructor(socket: WebSocket) {
    this.socket = socket;
    this.closed = new Promise((resolve, reject) => {
      socket.once("close", code => resolve(code));
      socket.once("error", reject);
    });

    socket.on("message", (data, isBinary) => {
      if (isBinary) {
        const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
        const waiter = this.audioWaiters.shift();
        if (waiter) {
          waiter(chunk);
        } else {
          this.audioChunks.push(chunk);
        }
        return;
      }

      const message = JSON.parse(data.toString("utf8")) as DeviceServerMessage;
      const waiter = this.waiters.shift();
      if (waiter) {
        waiter(message);
      } else {
        this.messages.push(message);
      }
    });
  }

  static async connect(url: string): Promise<TestClient> {
    const socket = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      socket.once("open", () => resolve());
      socket.once("error", reject);
    });
    return new TestClient(socket);
  }

  send(message: unknown): void {
    this.socket.send(JSON.stringify(message));
  }

  sendAudio(chunk: Buffer): void {
    this.socket.send(chunk, { binary: true });
  }

  next(): Promise<DeviceServerMessage> {
    const queued = this.messages.shift();
    if (queued) {
      return Promise.resolve(queued);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timed out waiting for message")), 2_000);
      this.waiters.push(message => {
        clearTimeout(timeout);
        resolve(message);
      });
    });
  }

  nextAudio(): Promise<Buffer> {
    const queued = this.audioChunks.shift();
    if (queued) {
      return Promise.resolve(queued);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timed out waiting for audio")), 2_000);
      this.audioWaiters.push(chunk => {
        clearTimeout(timeout);
        resolve(chunk);
      });
    });
  }

  async hello(token = DEVICE_TOKEN): Promise<DeviceServerMessage> {
    this.send({
      type: "hello",
      protocolVersion: 1,
      deviceId: "device-1",
      token,
      firmwareVersion: "0.1.0",
      locale: "en",
    });
    return this.next();
  }

  close(): void {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.close();
    }
  }
}

interface TestGateway {
  server: Server;
  gateway: DeviceGateway;
  url: string;
}

const openGateways: TestGateway[] = [];

async function startGateway(
  overrides: Partial<DeviceGatewayOptions> = {}
): Promise<TestGateway> {
  const server = createServer((_req, res) => {
    res.statusCode = 404;
    res.end();
  });

  const gateway = new DeviceGateway(server, {
    authenticateDevice: vi.fn(async (deviceId, token) => {
      if (deviceId !== "device-1" || token !== DEVICE_TOKEN) {
        throw new Error("DEVICE_UNAUTHORIZED");
      }
      return authenticatedDevice;
    }),
    helloTimeoutMs: 500,
    heartbeatIntervalMs: 60_000,
    audioTurnTimeoutMs: 500,
    logger: silentLogger,
    ...overrides,
  });

  await new Promise<void>(resolve => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("test server did not bind to a port");
  }

  const testGateway = {
    server,
    gateway,
    url: `ws://127.0.0.1:${address.port}/ws/device`,
  };
  openGateways.push(testGateway);
  return testGateway;
}

async function stopGateway(testGateway: TestGateway, client?: TestClient): Promise<void> {
  client?.close();
  await testGateway.gateway.close();
  await new Promise<void>(resolve => testGateway.server.close(() => resolve()));
}

afterEach(async () => {
  const gateways = openGateways.splice(0);
  for (const testGateway of gateways) {
    await testGateway.gateway.close();
    await new Promise<void>(resolve => testGateway.server.close(() => resolve()));
  }
});

describe("device WebSocket gateway", () => {
  it("authenticates with hello and sends the idle state", async () => {
    const testGateway = await startGateway();
    const client = await TestClient.connect(testGateway.url);

    const state = await client.hello();

    expect(state).toEqual({ type: "state", state: "idle" });
    expect(testGateway.gateway.size).toBe(1);

    await stopGateway(testGateway, client);
  });

  it("cancels the previous reply when a new turn starts", async () => {
    let release: () => void = () => undefined;
    const blocked = new Promise<void>(resolve => {
      release = resolve;
    });
    let firstFinished = false;
    let firstSession: DeviceSession | undefined;

    const testGateway = await startGateway({
      onAudioTurn: async (turn, session) => {
        if (turn.turnId !== "turn-1") {
          return;
        }

        firstSession = session;
        await blocked;
        firstFinished = true;
      },
    });
    const client = await TestClient.connect(testGateway.url);
    await client.hello();

    client.send({
      type: "audio.start",
      codec: "pcm16",
      sampleRate: 16_000,
      turnId: "turn-1",
    });
    expect(await client.next()).toMatchObject({
      type: "state",
      state: "listening",
      turnId: "turn-1",
    });
    client.sendAudio(Buffer.alloc(16));
    client.send({ type: "audio.end", turnId: "turn-1" });
    expect(await client.next()).toMatchObject({
      type: "state",
      state: "thinking",
      turnId: "turn-1",
    });

    await vi.waitFor(() => expect(firstSession).toBeDefined());
    expect(firstSession?.isTurnActive?.("turn-1")).toBe(true);

    client.send({
      type: "audio.start",
      codec: "pcm16",
      sampleRate: 16_000,
      turnId: "turn-2",
    });
    expect(await client.next()).toMatchObject({
      type: "state",
      state: "listening",
      turnId: "turn-2",
    });
    expect(firstSession?.isTurnActive?.("turn-1")).toBe(false);

    release();
    await vi.waitFor(() => expect(firstFinished).toBe(true));

    client.send({ type: "audio.end", turnId: "turn-2" });
    expect(await client.next()).toMatchObject({
      type: "state",
      state: "thinking",
      turnId: "turn-2",
    });
    expect(await client.next()).toMatchObject({
      type: "state",
      state: "idle",
      turnId: "turn-2",
    });

    await stopGateway(testGateway, client);
  });

  it("rejects an invalid device token and closes the connection", async () => {
    const testGateway = await startGateway();
    const client = await TestClient.connect(testGateway.url);

    const error = await client.hello("wrong-token-1234567890");

    expect(error).toMatchObject({ type: "error", code: "DEVICE_UNAUTHORIZED" });
    await expect(client.closed).resolves.toBe(4001);
    await vi.waitFor(() => expect(testGateway.gateway.size).toBe(0));

    await stopGateway(testGateway);
  });

  it("requires hello before audio messages", async () => {
    const testGateway = await startGateway();
    const client = await TestClient.connect(testGateway.url);

    client.send({ type: "audio.start", codec: "pcm16", sampleRate: 16_000, turnId: "t1" });

    const error = await client.next();
    expect(error).toMatchObject({ type: "error", code: "HELLO_REQUIRED" });
    await expect(client.closed).resolves.toBe(4001);

    await stopGateway(testGateway);
  });

  it("buffers audio frames for a turn and hands them to the pipeline", async () => {
    const turns: DeviceAudioTurn[] = [];
    const testGateway = await startGateway({
      onAudioTurn: turn => {
        turns.push(turn);
      },
    });
    const client = await TestClient.connect(testGateway.url);
    await client.hello();

    client.send({ type: "audio.start", codec: "pcm16", sampleRate: 16_000, turnId: "turn-1" });
    expect(await client.next()).toEqual({ type: "state", state: "listening", turnId: "turn-1" });

    client.sendAudio(Buffer.from([1, 2, 3]));
    client.sendAudio(Buffer.from([4, 5]));
    client.send({ type: "audio.end", turnId: "turn-1" });

    expect(await client.next()).toEqual({ type: "state", state: "thinking", turnId: "turn-1" });
    expect(await client.next()).toEqual({ type: "state", state: "idle", turnId: "turn-1" });

    expect(turns).toHaveLength(1);
    expect(turns[0]).toMatchObject({
      turnId: "turn-1",
      userId: "user-1",
      deviceId: "device-1",
      codec: "pcm16",
      sampleRate: 16_000,
      audio: Buffer.from([1, 2, 3, 4, 5]),
    });

    await stopGateway(testGateway, client);
  });

  it("can send the reply state and audio through the session", async () => {
    const testGateway = await startGateway({
      onAudioTurn: (_turn, session) => {
        session.setState("speaking", "turn-2");
        session.sendAudio(Buffer.from([9, 8, 7]));
        session.setState("idle", "turn-2");
      },
    });
    const client = await TestClient.connect(testGateway.url);
    await client.hello();

    client.send({ type: "audio.start", codec: "pcm16", sampleRate: 16_000, turnId: "turn-2" });
    await client.next();
    client.send({ type: "audio.end", turnId: "turn-2" });

    expect(await client.next()).toEqual({ type: "state", state: "thinking", turnId: "turn-2" });
    expect(await client.next()).toEqual({ type: "state", state: "speaking", turnId: "turn-2" });
    expect(await client.nextAudio()).toEqual(Buffer.from([9, 8, 7]));
    expect(await client.next()).toEqual({ type: "state", state: "idle", turnId: "turn-2" });

    await stopGateway(testGateway, client);
  });

  it("aborts an audio turn on timeout", async () => {
    const testGateway = await startGateway({ audioTurnTimeoutMs: 50 });
    const client = await TestClient.connect(testGateway.url);
    await client.hello();

    client.send({ type: "audio.start", codec: "pcm16", sampleRate: 16_000, turnId: "turn-3" });
    expect(await client.next()).toEqual({ type: "state", state: "listening", turnId: "turn-3" });

    expect(await client.next()).toMatchObject({ type: "error", code: "AUDIO_TIMEOUT" });
    expect(await client.next()).toEqual({ type: "state", state: "idle", turnId: "turn-3" });

    await stopGateway(testGateway, client);
  });

  it("rejects audio that exceeds the size limit", async () => {
    const testGateway = await startGateway({ maxAudioBytes: 8 });
    const client = await TestClient.connect(testGateway.url);
    await client.hello();

    client.send({ type: "audio.start", codec: "pcm16", sampleRate: 16_000, turnId: "turn-4" });
    await client.next();
    client.sendAudio(Buffer.alloc(16));

    expect(await client.next()).toMatchObject({ type: "error", code: "AUDIO_TOO_LARGE" });
    expect(await client.next()).toEqual({ type: "state", state: "idle", turnId: "turn-4" });

    await stopGateway(testGateway, client);
  });

  it("keeps a connection alive across heartbeat pings", async () => {
    const testGateway = await startGateway({ heartbeatIntervalMs: 40 });
    const client = await TestClient.connect(testGateway.url);
    await client.hello();

    await new Promise(resolve => setTimeout(resolve, 150));

    expect(client.socket.readyState).toBe(WebSocket.OPEN);
    expect(testGateway.gateway.size).toBe(1);

    await stopGateway(testGateway, client);
  });
});
