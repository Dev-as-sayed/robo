import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatGroq } from "@langchain/groq";
import { ChatOllama } from "@langchain/ollama";
import { ChatOpenAI } from "@langchain/openai";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import type { AIMessageChunk } from "@langchain/core/messages";
import type { Runnable } from "@langchain/core/runnables";
import { env } from "../../config/env";
import logger from "../../lib/logger";

export const LLM_PROVIDERS = ["gemini", "groq", "openrouter", "ollama"] as const;

export type LlmProvider = (typeof LLM_PROVIDERS)[number];
export type ChatTask =
  | "voice_chat"
  | "agent_tools"
  | "structured_generation"
  | "vision"
  | "private_docs";

export type ChatRunnable = Runnable<BaseLanguageModelInput, AIMessageChunk>;

export interface ModelSpec {
  provider: LlmProvider;
  model: string;
}

const TASK_CHAINS: Record<ChatTask, string> = {
  voice_chat: env.LLM_VOICE_CHAT_CHAIN,
  agent_tools: env.LLM_AGENT_TOOLS_CHAIN,
  structured_generation: env.LLM_STRUCTURED_CHAIN,
  vision: env.LLM_VISION_CHAIN,
  private_docs: env.LLM_PRIVATE_DOCS_CHAIN,
};

const modelCache = new Map<ChatTask, ChatRunnable>();

function isLlmProvider(value: string): value is LlmProvider {
  return (LLM_PROVIDERS as readonly string[]).includes(value);
}

export function parseModelChain(chain: string): ModelSpec[] {
  return chain
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separator = entry.indexOf(":");
      if (separator <= 0 || separator === entry.length - 1) {
        throw new Error("AI_CONFIGURATION_INVALID");
      }

      const provider = entry.slice(0, separator).trim().toLowerCase();
      const model = entry.slice(separator + 1).trim();

      if (!isLlmProvider(provider) || !model) {
        throw new Error("AI_CONFIGURATION_INVALID");
      }

      return { provider, model };
    });
}

function providerApiKey(provider: LlmProvider): string | undefined {
  switch (provider) {
    case "gemini":
      return env.GEMINI_API_KEY || undefined;
    case "groq":
      return env.GROQ_API_KEY || undefined;
    case "openrouter":
      return env.OPENROUTER_API_KEY || undefined;
    case "ollama":
      return env.OLLAMA_BASE_URL || undefined;
  }
}

export function parseRegressionScores(
  value: string | undefined
): Record<string, number> {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, number] =>
          typeof entry[1] === "number" && Number.isFinite(entry[1])
      )
    );
  } catch {
    logger.warn("LLM_MODEL_REGRESSION_SCORES is not valid JSON; model gating disabled");
    return {};
  }
}

/**
 * Drops models whose latest regression score is below the configured floor.
 * Models without a recorded score stay in the chain so a new provider is usable
 * before it has been benchmarked.
 */
export function gateModelsByRegression(
  specs: readonly ModelSpec[],
  scores: Record<string, number>,
  minimum: number
): ModelSpec[] {
  if (minimum <= 0) {
    return [...specs];
  }

  const gated = specs.filter((spec) => {
    const score = scores[`${spec.provider}:${spec.model}`];
    return score === undefined || score >= minimum;
  });

  return gated.length > 0 ? gated : [...specs];
}

function createModel(spec: ModelSpec): BaseChatModel | null {
  const apiKey = providerApiKey(spec.provider);

  if (!apiKey) {
    return null;
  }

  switch (spec.provider) {
    case "gemini":
      return new ChatGoogleGenerativeAI({
        apiKey,
        model: spec.model,
        temperature: env.AI_TEMPERATURE,
        maxOutputTokens: env.AI_MAX_OUTPUT_TOKENS,
      });
    case "groq":
      return new ChatGroq({
        apiKey,
        model: spec.model,
        temperature: env.AI_TEMPERATURE,
        maxTokens: env.AI_MAX_OUTPUT_TOKENS,
      });
    case "openrouter":
      return new ChatOpenAI({
        apiKey,
        model: spec.model,
        temperature: env.AI_TEMPERATURE,
        maxTokens: env.AI_MAX_OUTPUT_TOKENS,
        configuration: {
          baseURL: env.OPENROUTER_BASE_URL,
        },
      });
    case "ollama":
      return new ChatOllama({
        baseUrl: apiKey,
        model: spec.model,
        temperature: env.AI_TEMPERATURE,
        numPredict: env.AI_MAX_OUTPUT_TOKENS,
      });
  }
}

export function getChatModel(task: ChatTask): ChatRunnable {
  const cached = modelCache.get(task);
  if (cached) {
    return cached;
  }

  const specs = gateModelsByRegression(
    parseModelChain(TASK_CHAINS[task]),
    parseRegressionScores(env.LLM_MODEL_REGRESSION_SCORES),
    env.LLM_MIN_MODEL_REGRESSION_SCORE
  );
  const models = specs
    .map(createModel)
    .filter((model): model is BaseChatModel => model !== null);

  if (models.length === 0) {
    throw new Error("AI_NOT_CONFIGURED");
  }

  const model =
    models.length === 1 ? models[0] : models[0].withFallbacks(models.slice(1));

  logger.debug(
    {
      task,
      chain: specs.map((spec) => `${spec.provider}:${spec.model}`),
      configured: models.length,
    },
    "AI model chain resolved"
  );

  modelCache.set(task, model);
  return model;
}

export function clearChatModelCache(): void {
  modelCache.clear();
}

export function getChatModels(task: ChatTask): BaseChatModel[] {
  const specs = gateModelsByRegression(
    parseModelChain(TASK_CHAINS[task]),
    parseRegressionScores(env.LLM_MODEL_REGRESSION_SCORES),
    env.LLM_MIN_MODEL_REGRESSION_SCORE
  );
  return specs
    .map(createModel)
    .filter((model): model is BaseChatModel => model !== null);
}
