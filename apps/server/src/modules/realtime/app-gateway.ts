import type { IncomingMessage, Server as HttpServer } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer } from "ws";
import type { AppActionEvent } from "../actions/events";

export const APP_WS_PATH = "/ws/app";
const AUTH_CLOSE_CODE = 4001;
const UNAUTHORIZED = "HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n";

export interface AppIdentity {
  userId: string;
  expiresAt?: number;
}

export interface AppGatewayOptions {
  authenticate: (token: string) => Promise<AppIdentity>;
  heartbeatIntervalMs?: number;
}

interface AppConnection {
  userId: string;
  socket: WebSocket;
  expiry: NodeJS.Timeout | null;
}

export class AppGateway {
  private readonly wss: WebSocketServer;
  private readonly server: HttpServer;
  private readonly options: AppGatewayOptions;
  private readonly connections = new Map<WebSocket, AppConnection>();
  private readonly onUpgrade: (req: IncomingMessage, socket: Duplex, head: Buffer) => void;
  private heartbeat: NodeJS.Timeout;
  private closed = false;

  constructor(server: HttpServer, options: AppGatewayOptions) {
    this.server = server;
    this.options = options;

    this.wss = new WebSocketServer({
      noServer: true,
      maxPayload: 16 * 1024,
    });

    this.wss.on(
      "connection",
      (socket: WebSocket, _request: IncomingMessage, identity: AppIdentity): void => {
        this.accept(socket, identity);
      }
    );

    this.onUpgrade = (req, socket, head): void => {
      const url = this.parseUrl(req);
      if (!url || url.pathname !== APP_WS_PATH) {
        return;
      }

      const token = url.searchParams.get("token") ?? "";
      if (!token) {
        socket.write(UNAUTHORIZED);
        socket.destroy();
        return;
      }

      void this.options
        .authenticate(token)
        .then(identity => {
          if (socket.destroyed) return;

          this.wss.handleUpgrade(req, socket, head, ws => {
            this.wss.emit("connection", ws, req, identity);
          });
        })
        .catch(() => {
          if (socket.destroyed) return;
          socket.write(UNAUTHORIZED);
          socket.destroy();
        });
    };

    this.server.on("upgrade", this.onUpgrade);

    this.heartbeat = setInterval(() => {
      for (const connection of this.connections.values()) {
        if (connection.socket.readyState === WebSocket.OPEN) {
          connection.socket.ping();
        }
      }
    }, options.heartbeatIntervalMs ?? 30_000);
    this.heartbeat.unref();
  }

  notifyUser(userId: string, event: AppActionEvent): number {
    const payload = JSON.stringify(event);
    let delivered = 0;

    for (const connection of this.connections.values()) {
      if (connection.userId !== userId) continue;
      if (connection.socket.readyState !== WebSocket.OPEN) continue;

      connection.socket.send(payload);
      delivered += 1;
    }

    return delivered;
  }

  get size(): number {
    return this.connections.size;
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;

    clearInterval(this.heartbeat);
    this.server.off("upgrade", this.onUpgrade);

    for (const connection of this.connections.values()) {
      if (connection.expiry) clearTimeout(connection.expiry);
      connection.socket.close(1001, "server shutting down");
    }

    await new Promise<void>(resolve => {
      this.wss.close(() => resolve());
    });
    this.connections.clear();
  }

  private accept(socket: WebSocket, identity: AppIdentity): void {
    if (this.closed) {
      socket.close(1001, "gateway closed");
      return;
    }

    const expiry =
      identity.expiresAt && identity.expiresAt > Date.now()
        ? setTimeout(() => socket.close(AUTH_CLOSE_CODE, "token expired"), identity.expiresAt - Date.now())
        : null;

    if (expiry) expiry.unref();

    this.connections.set(socket, {
      userId: identity.userId,
      socket,
      expiry,
    });

    socket.on("close", () => {
      const connection = this.connections.get(socket);
      if (connection?.expiry) clearTimeout(connection.expiry);
      this.connections.delete(socket);
    });
  }

  private parseUrl(req: IncomingMessage): URL | null {
    try {
      return new URL(req.url ?? "/", "http://localhost");
    } catch {
      return null;
    }
  }
}
