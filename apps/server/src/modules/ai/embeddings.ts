import { OllamaEmbeddings } from "@langchain/ollama";
import { env } from "../../config/env";

let embeddings: OllamaEmbeddings | null = null;

export function getEmbeddings(): OllamaEmbeddings {
  if (!env.OLLAMA_BASE_URL) {
    throw new Error("AI_NOT_CONFIGURED");
  }

  if (!embeddings) {
    embeddings = new OllamaEmbeddings({
      baseUrl: env.OLLAMA_BASE_URL,
      model: env.EMBEDDING_MODEL,
    });
  }

  return embeddings;
}

export function isEmbeddingConfigured(): boolean {
  return Boolean(env.OLLAMA_BASE_URL);
}

export function clearEmbeddingsCache(): void {
  embeddings = null;
}
