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
import { SileroVad } from "./modules/realtime/vad";
import { createReminderNotifier } from "./modules/reminders/notify";
import { ReminderScheduler } from "./modules/reminders/scheduler";
import { createVoiceTurnHandler } from "./modules/voice/pipeline";

const app = createApp();
const server = createServer(app);
const voiceTurnHandler = createVoiceTurnHandler({ logger });

const vad = env.DEVICE_VAD_ENABLED
  ? await SileroVad.create({
      modelPath: env.DEVICE_VAD_MODEL_PATH,
      silenceMs: env.DEVICE_VAD_SILENCE_MS,
      minSpeechMs: env.DEVICE_VAD_MIN_SPEECH_MS,
    }).catch((error: unknown) => {
      logger.warn({ err: error }, "silero vad unavailable; voice turns require audio.end");
      return null;
    })
  : null;

if (vad) {
  logger.info(
    {
      silenceMs: env.DEVICE_VAD_SILENCE_MS,
      minSpeechMs: env.DEVICE_VAD_MIN_SPEECH_MS,
    },
    "silero vad enabled"
  );
}

const deviceGateway = new DeviceGateway(server, {
  authenticateDevice: (
    deviceId,
    token,
    metadata
  ): Promise<AuthenticatedDevice> =>
    authenticateDeviceToken(deviceId, token, metadata),
  onAudioTurn: voiceTurnHandler,
  onDisconnect: (deviceId): Promise<void> => markDevicePresence(deviceId, "OFFLINE"),
  onHeartbeat: touchDeviceLastSeen,
  heartbeatIntervalMs: env.DEVICE_HEARTBEAT_INTERVAL_MS,
  helloTimeoutMs: env.DEVICE_HELLO_TIMEOUT_MS,
  audioTurnTimeoutMs: env.DEVICE_AUDIO_TURN_TIMEOUT_MS,
  maxAudioBytes: env.DEVICE_AUDIO_MAX_BYTES,
  ...(vad ? { vad } : {}),
  logger,
});

const reminderScheduler = env.REMINDER_SCHEDULER_ENABLED
  ? new ReminderScheduler({
      intervalMs: env.REMINDER_TICK_INTERVAL_MS,
      logger,
      deliver: createReminderNotifier({
        notifyUser: (userId, message): number => deviceGateway.notifyUser(userId, message),
        logger,
      }),
    })
  : null;

reminderScheduler?.start();

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

  reminderScheduler?.stop();

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
