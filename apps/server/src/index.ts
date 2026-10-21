import { createServer } from "node:http";
import {
  authenticateDeviceToken,
  markDevicePresence,
  touchDeviceLastSeen,
  type AuthenticatedDevice,
} from "@robo/shared/devices";
import { createApp } from "./app";
import { env } from "./config/env";
import logger from "./lib/logger";
import { DeviceGateway } from "./modules/realtime/gateway";

const app = createApp();
const server = createServer(app);

const deviceGateway = new DeviceGateway(server, {
  authenticateDevice: (
    deviceId,
    token,
    metadata
  ): Promise<AuthenticatedDevice> =>
    authenticateDeviceToken(deviceId, token, metadata),
  onDisconnect: (deviceId): Promise<void> => markDevicePresence(deviceId, "OFFLINE"),
  onHeartbeat: touchDeviceLastSeen,
  heartbeatIntervalMs: env.DEVICE_HEARTBEAT_INTERVAL_MS,
  helloTimeoutMs: env.DEVICE_HELLO_TIMEOUT_MS,
  audioTurnTimeoutMs: env.DEVICE_AUDIO_TURN_TIMEOUT_MS,
  maxAudioBytes: env.DEVICE_AUDIO_MAX_BYTES,
  logger,
});

server.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "server started");
});

let shuttingDown = false;

function shutdown(signal: string, exitCode = 0): void {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.info({ signal }, "shutting down");

  void deviceGateway.close().catch((error: unknown) => {
    logger.warn({ err: error }, "error while closing device gateway");
  });

  server.close((error) => {
    if (error) {
      logger.error({ err: error }, "error while shutting down");
      process.exit(1);
    }

    process.exit(exitCode);
  });

  setTimeout(() => {
    logger.warn("forced shutdown after timeout");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "unhandled promise rejection");
  shutdown("unhandledRejection", 1);
});

process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "uncaught exception");
  shutdown("uncaughtException", 1);
});

export { app };
