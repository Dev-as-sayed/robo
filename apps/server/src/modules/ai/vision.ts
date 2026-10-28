import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import {
  classifyProviderError,
  toProviderError,
} from "./provider-errors";
import { getChatModels } from "./llm-router";
import { extractAssistantText } from "./prompt";
import logger from "../../lib/logger";

export const VISION_MAX_BYTES = 5 * 1024 * 1024;

export interface VisionInput {
  imageBase64: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  question?: string;
}

export interface VisionResult {
  answer: string;
  model?: string;
  usage?: unknown;
}

function dataUrl(input: VisionInput): string {
  return `data:${input.mimeType};base64,${input.imageBase64}`;
}

export async function explainImage(
  input: VisionInput,
  models: BaseChatModel[] = getChatModels("vision")
): Promise<VisionResult> {
  if (models.length === 0) {
    throw new Error("AI_NOT_CONFIGURED");
  }

  const question =
    input.question?.trim() ||
    "Explain the formula or problem in this image step by step.";

  let lastError: unknown;

  for (const model of models) {
    try {
      const response = await model.invoke([
        new SystemMessage(
          "You are Robo, a study assistant. Focus only on academic content such as formulas, diagrams, handwriting and problems. Do not identify people or infer sensitive traits. If the image is not study material, say so briefly. Explain steps clearly and never invent values that are not visible."
        ),
        new HumanMessage({
          content: [
            { type: "text", text: question },
            { type: "image_url", image_url: { url: dataUrl(input) } },
          ],
        }),
      ]);

      const answer = extractAssistantText(response);
      if (!answer) {
        throw new Error("AI_EMPTY_RESPONSE");
      }

      const metadata = response.response_metadata as
        | Record<string, unknown>
        | undefined;

      return {
        answer,
        ...(typeof metadata?.model_name === "string"
          ? { model: metadata.model_name }
          : {}),
        usage: (response as { usage_metadata?: unknown }).usage_metadata,
      };
    } catch (error) {
      lastError = error;
      logger.warn(
        {
          err: error,
          providerError: classifyProviderError(error),
          model: model.constructor.name,
        },
        "vision model failed"
      );
    }
  }

  throw toProviderError(lastError);
}
