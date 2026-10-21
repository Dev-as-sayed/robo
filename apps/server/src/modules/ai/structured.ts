import type { z } from "zod";
import { getChatModels } from "./llm-router";

export async function generateStructured<T>(
  schema: z.ZodType<T>,
  prompt: string
): Promise<T> {
  const models = getChatModels("structured_generation");

  if (models.length === 0) {
    throw new Error("AI_NOT_CONFIGURED");
  }

  let lastError: unknown;

  for (const model of models) {
    try {
      return (await model.withStructuredOutput(schema).invoke(prompt)) as T;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("AI_PROVIDER_UNAVAILABLE");
}
