import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { AppGateway } from "../src/modules/realtime/app-gateway";

let server: Server | null = null;
let gateway: AppGateway | null = null;

async function start(): Promise<{ port: number; gateway: AppGateway }> {
  server = createServer();
  gateway = new AppGateway(server, {
    authenticate: async token => {
      if (token === "expired") {
        return { userId: "user-1", expiresAt: Date.now() + 100 };
      }
      if (token !== "good") {
        throw new Error("bad token");
      }
      return { userId: "user-1" };
    },
    heartbeatIntervalMs: 60_000,
  });

  await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
  const address = server!.address();
  if (!address || typeof address === "string") throw new Error("no port");
  return { port: address.port, gateway };
}

function open(port: number, token: string): Promise<WebSocket> {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws/app?token=${token}`);
  return new Promise((resolve, reject) => {
    socket.once("open", () => resolve(socket));
    socket.once("error", reject);
    socket.once("unexpected-response", (_request, response) => {
      reject(new Error(`unexpected response ${response.statusCode}`));
    });
  });
}

async function nextMessage(socket: WebSocket): Promise<unknown> {
  return new Promise((resolve, reject) => {
    socket.once("message", data => resolve(JSON.parse(String(data))));
    socket.once("error", reject);
  });
}

afterEach(async () => {
  await gateway?.close();
  gateway = null;
  await new Promise<void>(resolve => {
    if (!server) return resolve();
    server.close(() => resolve());
  });
  server = null;
});

describe("app WebSocket gateway", () => {
  it("authenticates, delivers events to the owning user and ignores other users", async () => {
    const { port, gateway } = await start();
    const client = await open(port, "good");
    const received = nextMessage(client);

    expect(
      gateway.notifyUser("user-1", {
        type: "action.confirm.request",
        action: {
          id: "action-1",
          kind: "CALL",
          recipientName: "Sam",
          status: "PENDING",
          expiresAt: new Date().toISOString(),
        },
      })
    ).toBe(1);
    expect(gateway.notifyUser("user-2", {
      type: "action.execute",
      action: {
        id: "action-2",
        kind: "MESSAGE",
        recipientName: "Alex",
        status: "CONFIRMED",
        expiresAt: new Date().toISOString(),
      },
    })).toBe(0);

    await expect(received).resolves.toMatchObject({
      type: "action.confirm.request",
      action: { id: "action-1" },
    });
    client.close();
  });

  it("rejects a bad token before upgrading", async () => {
    const { port } = await start();
    await expect(open(port, "bad")).rejects.toThrow();
  });

  it("closes the socket when the access token expiry fires", async () => {
    const { port } = await start();
    const client = await open(port, "expired");
    const closed = new Promise<number>(resolve => {
      client.once("close", code => resolve(code));
    });

    await expect(closed).resolves.toBe(4001);
  });
});
