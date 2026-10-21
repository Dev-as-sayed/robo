import pino from "pino";
import { env } from "../config/env";

const logger = pino({
  level: env.LOG_LEVEL,
  base: {
    service: "robo-server",
    environment: env.NODE_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
      "*.password",
      "*.token",
      "*.passwordHash",
    ],
    censor: "[REDACTED]",
  },
});

export default logger;
