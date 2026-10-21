import { createApp } from "./app";
import { env } from "./config/env";
import logger from "./lib/logger";

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "server started");
});

let shuttingDown = false;

function shutdown(signal: string, exitCode = 0): void {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.info({ signal }, "shutting down");

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
