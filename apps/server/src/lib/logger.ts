import pino from "pino";
import pinoHttp from "pino-http";

const transport = pino.multistream([
  { level: "info", target: "pino/file", options: { dest: "/var/log/robo/app.log" } },
  { level: "warn", target: "pino/file", options: { dest: "/var/log/robo/warn.log" } },
  { level: "error", target: "pino/file", options: { dest: "/var/log/robo/error.log" } },
]);

const logger = pino(
  {
    level: process.env.LOG_LEVEL || "info",
    transport,
    serializers: pino.stdSerializers,
  },
  pinoHttp({
    logger,
    translateMessage: true,
  })
);

export { logger };
export type { pino.Logger } from "pino";