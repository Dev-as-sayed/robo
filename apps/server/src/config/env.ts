import "dotenv/config";
import { z } from "zod";

const DEVELOPMENT_JWT_SECRET = "development-only-jwt-secret-change-me-please";

function emptyToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

const optionalEnvString = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(1).optional()
);

const optionalEnvUrl = z.preprocess(
  emptyToUndefined,
  z.string().url().optional()
);

const booleanEnv = z.preprocess(value => {
  if (typeof value !== "string") {
    return value;
  }

  if (value.trim().toLowerCase() === "true") {
    return true;
  }

  if (value.trim().toLowerCase() === "false") {
    return false;
  }

  return value;
}, z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:3000"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  JWT_SECRET: z.string().min(32).optional(),
  JWT_ACCESS_EXPIRES_IN: z.string().regex(/^\d+[smhd]$/).default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().regex(/^\d+[smhd]$/).default("30d"),
  GOOGLE_CLIENT_ID: optionalEnvString,
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  PAIRING_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  PAIRING_CODE_TTL_MINUTES: z.coerce.number().int().min(1).max(60).default(10),
  DATABASE_URL: z.string().min(1).optional(),
  AI_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
  AI_HISTORY_MESSAGES: z.coerce.number().int().min(1).max(100).default(20),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(64).max(8192).default(512),
  AI_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.4),
  AI_AGENT_STEP_LIMIT: z.coerce.number().int().min(2).max(25).default(8),
  GEMINI_API_KEY: z.string().trim().optional(),
  GROQ_API_KEY: z.string().trim().optional(),
  OPENROUTER_API_KEY: z.string().trim().optional(),
  OPENROUTER_BASE_URL: z.string().url().default("https://openrouter.ai/api/v1"),
  OLLAMA_BASE_URL: z.string().url().optional(),
  LLM_VOICE_CHAT_CHAIN: z
    .string()
    .min(1)
    .default(
      "groq:llama-3.3-70b-versatile,gemini:gemini-2.5-flash,openrouter:meta-llama/llama-3.3-70b-instruct:free,ollama:llama3.2"
    ),
  LLM_AGENT_TOOLS_CHAIN: z
    .string()
    .min(1)
    .default(
      "gemini:gemini-2.5-flash,groq:llama-3.3-70b-versatile,openrouter:meta-llama/llama-3.3-70b-instruct:free,ollama:llama3.2"
    ),
  LLM_STRUCTURED_CHAIN: z
    .string()
    .min(1)
    .default(
      "gemini:gemini-2.5-flash,groq:llama-3.3-70b-versatile,openrouter:meta-llama/llama-3.3-70b-instruct:free,ollama:llama3.2"
    ),
  LLM_VISION_CHAIN: z.string().min(1).default("gemini:gemini-2.5-flash"),
  LLM_PRIVATE_DOCS_CHAIN: z.string().min(1).default("ollama:llama3.2"),
  EMBEDDING_MODEL: z.string().min(1).default("bge-m3"),
  QDRANT_URL: z.string().url().optional(),
  QDRANT_API_KEY: z.string().trim().optional(),
  QDRANT_COLLECTION: z.string().min(1).default("document_chunks"),
  QDRANT_SCORE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.35),
  LANGFUSE_PUBLIC_KEY: z.string().trim().optional(),
  LANGFUSE_SECRET_KEY: z.string().trim().optional(),
  LANGFUSE_HOST: z.string().url().default("https://cloud.langfuse.com"),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  BODY_LIMIT: z.string().min(1).default("10mb"),
  DEVICE_HELLO_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  DEVICE_HEARTBEAT_INTERVAL_MS: z.coerce.number().int().positive().default(30_000),
  DEVICE_AUDIO_TURN_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  DEVICE_AUDIO_MAX_BYTES: z.coerce.number().int().positive().default(2 * 1024 * 1024),
  DEVICE_VAD_ENABLED: booleanEnv.default(true),
  DEVICE_VAD_SILENCE_MS: z.coerce.number().int().min(200).max(3_000).default(800),
  DEVICE_VAD_MIN_SPEECH_MS: z.coerce.number().int().min(0).max(2_000).default(250),
  DEVICE_VAD_MODEL_PATH: optionalEnvString,
  REMINDER_SCHEDULER_ENABLED: booleanEnv.default(true),
  REMINDER_TICK_INTERVAL_MS: z.coerce.number().int().min(1_000).default(15_000),
  STT_SERVICE_URL: optionalEnvUrl,
  STT_SERVICE_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  STT_LANGUAGE: z.preprocess(
    emptyToUndefined,
    z.string().trim().min(2).max(10).optional()
  ),
  GROQ_STT_MODEL: z.string().min(1).default("whisper-large-v3-turbo"),
  TTS_SERVICE_URL: optionalEnvUrl,
  TTS_SERVICE_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  TTS_VOICE: optionalEnvString,
  TTS_VOICE_MAP: optionalEnvString,
  TTS_SAMPLE_RATE: z.coerce.number().int().min(8_000).max(48_000).default(16_000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid environment configuration: ${details}`);
}

if (parsed.data.NODE_ENV === "production" && !parsed.data.JWT_SECRET) {
  throw new Error("JWT_SECRET is required in production");
}

const jwtSecret = parsed.data.JWT_SECRET ?? DEVELOPMENT_JWT_SECRET;

process.env.JWT_SECRET = jwtSecret;
process.env.JWT_ACCESS_EXPIRES_IN = parsed.data.JWT_ACCESS_EXPIRES_IN;
process.env.JWT_REFRESH_EXPIRES_IN = parsed.data.JWT_REFRESH_EXPIRES_IN;
process.env.PAIRING_CODE_TTL_MINUTES = String(parsed.data.PAIRING_CODE_TTL_MINUTES);

export const env = {
  ...parsed.data,
  JWT_SECRET: jwtSecret,
} as const;
