import { createServer } from "node:http";
import {
  authenticateDeviceToken,
  markDevicePresence,
  touchDeviceLastSeen,
  type AuthenticatedDevice,
} from "@robo/shared/devices";
import { verifyAccessToken } from "@robo/shared/auth";
import { createApp } from "./app";
import { initSentry } from "./lib/sentry";
import { env } from "./config/env";
import logger from "./lib/logger";
import { DailyStatsJob } from "./modules/analytics/daily-stats-job";
import { markReminderDeliverySent } from "@robo/shared/reminders";
import { takePendingDeviceEvents } from "@robo/shared/realtime/pending";
import { setDeviceNotifier } from "./modules/devices/notifier";
import { DeviceGateway } from "./modules/realtime/gateway";
import { AppGateway } from "./modules/realtime/app-gateway";
import { setAppEventNotifier } from "./modules/actions/events";
import { SileroVad } from "./modules/realtime/vad";
import { retryDueReminderDeliveries } from "./modules/reminders/delivery-retry";
import { createClassAlertNotifier } from "./modules/schedule/class-alert-notifier";
import { createTodoDeadlineNotifier } from "./modules/todos/deadline-notifier";
import { TodoDeadlineScheduler } from "./modules/todos/deadline-scheduler";
import { ClassAlertScheduler } from "./modules/schedule/class-alert-scheduler";
import { ClassNoteScheduler } from "./modules/class-notes/scheduler";
import { createClassNoteNotifier } from "./modules/class-notes/notifier";
import { DataCleanupJob } from "./modules/maintenance/cleanup-job";
import { PendingActionScheduler } from "./modules/actions/pending-scheduler";
import { createNudgeNotifier } from "./modules/nudges/notifier";
import { NudgeScheduler } from "./modules/nudges/scheduler";
import { createReminderNotifier } from "./modules/reminders/notify";
import { ReminderScheduler } from "./modules/reminders/scheduler";
import { createVoiceTurnHandler } from "./modules/voice/pipeline";
import { isRagConfigured } from "./modules/ai/qdrant";
import { DocumentIngestionJob } from "./modules/documents/ingestion-job";
import { closeOcrWorker } from "./modules/documents/ocr";

initSentry();

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
  onDeviceReady: async (userId, send): Promise<void> => {
    const events = await takePendingDeviceEvents(userId);

    for (const event of events) {
      send(event.message);

      if (event.message.type === "reminder.fire") {
        await markReminderDeliverySent(
          event.message.reminderId,
          new Date(event.message.dueAt),
          "device"
        );
      }
    }

    if (events.length > 0) {
      logger.info({ userId, events: events.length }, "queued device events delivered");
    }
  },
  heartbeatIntervalMs: env.DEVICE_HEARTBEAT_INTERVAL_MS,
  helloTimeoutMs: env.DEVICE_HELLO_TIMEOUT_MS,
  audioTurnTimeoutMs: env.DEVICE_AUDIO_TURN_TIMEOUT_MS,
  maxAudioBytes: env.DEVICE_AUDIO_MAX_BYTES,
  ...(vad ? { vad } : {}),
  logger,
});

setDeviceNotifier((userId, message): number => deviceGateway.notifyUser(userId, message));

const appGateway = new AppGateway(server, {
  authenticate: async token => {
    const payload = verifyAccessToken(token);
    return {
      userId: payload.sub,
      ...(payload.exp ? { expiresAt: payload.exp * 1_000 } : {}),
    };
  },
});

setAppEventNotifier((userId, event): number => appGateway.notifyUser(userId, event));

const reminderScheduler = env.REMINDER_SCHEDULER_ENABLED
  ? new ReminderScheduler({
      intervalMs: env.REMINDER_TICK_INTERVAL_MS,
      logger,
      deliver: createReminderNotifier({
        notifyUser: (userId, message): number => deviceGateway.notifyUser(userId, message),
        logger,
      }),
      retry: (now) =>
        retryDueReminderDeliveries(now, {
          notifyUser: (userId, message): number => deviceGateway.notifyUser(userId, message),
        }),
    })
  : null;

const classAlertScheduler = env.REMINDER_SCHEDULER_ENABLED
  ? new ClassAlertScheduler({
      intervalMs: env.REMINDER_TICK_INTERVAL_MS,
      logger,
      deliver: createClassAlertNotifier({
        notifyUser: (userId, message): number => deviceGateway.notifyUser(userId, message),
        logger,
      }),
    })
  : null;

const deadlineScheduler = env.REMINDER_SCHEDULER_ENABLED
  ? new TodoDeadlineScheduler({
      intervalMs: env.REMINDER_TICK_INTERVAL_MS,
      logger,
      deliver: createTodoDeadlineNotifier({
        notifyUser: (userId, message): number => deviceGateway.notifyUser(userId, message),
        logger,
      }),
    })
  : null;

const classNoteScheduler = env.CLASS_NOTE_PROMPT_ENABLED
  ? new ClassNoteScheduler({
      intervalMs: env.CLASS_NOTE_TICK_INTERVAL_MS,
      logger,
      deliver: createClassNoteNotifier({
        notifyUser: (userId, message): number => deviceGateway.notifyUser(userId, message),
        logger,
      }),
    })
  : null;

const pendingActionScheduler = env.REMINDER_SCHEDULER_ENABLED
  ? new PendingActionScheduler({ logger })
  : null;

const nudgeScheduler = env.NUDGE_SCHEDULER_ENABLED
  ? new NudgeScheduler({
      intervalMs: env.NUDGE_TICK_INTERVAL_MS,
      logger,
      deliver: createNudgeNotifier({
        notifyUser: (userId, message): number => deviceGateway.notifyUser(userId, message),
        logger,
      }),
    })
  : null;

reminderScheduler?.start();
classAlertScheduler?.start();
deadlineScheduler?.start();
classNoteScheduler?.start();
pendingActionScheduler?.start();
nudgeScheduler?.start();
const dailyStatsJob = new DailyStatsJob();
dailyStatsJob.start();

const cleanupJob = env.CLEANUP_JOB_ENABLED
  ? new DataCleanupJob({
      retentionDays: env.DATA_RETENTION_DAYS,
      intervalMs: env.CLEANUP_INTERVAL_MS,
      logger,
    })
  : null;
cleanupJob?.start();

const documentIngestionJob =
  env.DOCUMENT_INGESTION_ENABLED && isRagConfigured()
    ? new DocumentIngestionJob({
        intervalMs: env.DOCUMENT_INGESTION_INTERVAL_MS,
        staleAfterMs: env.DOCUMENT_INGESTION_STALE_MS,
        maxAttempts: env.DOCUMENT_INGESTION_MAX_ATTEMPTS,
        backoffBaseMs: env.DOCUMENT_INGESTION_BACKOFF_MS,
        reindexEnabled: env.DOCUMENT_REINDEX_ENABLED,
        reindexIntervalMs: env.DOCUMENT_REINDEX_INTERVAL_MS,
        embeddingModel: env.EMBEDDING_MODEL,
        logger,
      })
    : null;
documentIngestionJob?.start();

if (env.DOCUMENT_INGESTION_ENABLED && !documentIngestionJob) {
  logger.warn(
    "document ingestion is enabled but Qdrant/embeddings are not configured; uploads will stay unindexed"
  );
}

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
  classAlertScheduler?.stop();
classNoteScheduler?.stop();
  deadlineScheduler?.stop();
  pendingActionScheduler?.stop();
  nudgeScheduler?.stop();
  dailyStatsJob.stop();
cleanupJob?.stop();
documentIngestionJob?.stop();
void closeOcrWorker();
  setDeviceNotifier(null);
  setAppEventNotifier(null);

  void deviceGateway.close().catch((error: unknown) => {
    logger.warn({ err: error }, "error while closing device gateway");
  });
  void appGateway.close().catch((error: unknown) => {
    logger.warn({ err: error }, "error while closing app gateway");
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
