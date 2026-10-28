import { Document } from "@langchain/core/documents";
import { QdrantVectorStore } from "@langchain/qdrant";
import { QdrantClient } from "@qdrant/js-client-rest";
import { env } from "../../config/env";
import { getEmbeddings, isEmbeddingConfigured } from "./embeddings";

let vectorStore: QdrantVectorStore | null = null;
let qdrantClient: QdrantClient | null = null;

function getClient(): QdrantClient {
  if (!env.QDRANT_URL) {
    throw new Error("RAG_NOT_CONFIGURED");
  }

  if (!qdrantClient) {
    qdrantClient = new QdrantClient({
      url: env.QDRANT_URL,
      apiKey: env.QDRANT_API_KEY,
    });
  }

  return qdrantClient;
}

export async function ensureDocumentCollection(): Promise<void> {
  const client = getClient();
  const collections = await client.getCollections();
  const exists = collections.collections.some(
    (collection) => collection.name === env.QDRANT_COLLECTION
  );

  if (!exists) {
    const probe = await getEmbeddings().embedQuery("dimension probe");
    await client.createCollection(env.QDRANT_COLLECTION, {
      vectors: { size: probe.length, distance: "Cosine" },
    });
  }

  for (const field of ["userId", "documentId", "subjectId"]) {
    try {
      await client.createPayloadIndex(env.QDRANT_COLLECTION, {
        field_name: field,
        field_schema: "keyword",
        wait: true,
      });
    } catch {
      // The index already exists or the backend does not support this field.
    }
  }
}

export function isRagConfigured(): boolean {
  return Boolean(env.QDRANT_URL) && isEmbeddingConfigured();
}

export function getVectorStore(): QdrantVectorStore {
  if (!env.QDRANT_URL || !isEmbeddingConfigured()) {
    throw new Error("RAG_NOT_CONFIGURED");
  }

  if (!vectorStore) {
    vectorStore = new QdrantVectorStore(getEmbeddings(), {
      client: getClient(),
      collectionName: env.QDRANT_COLLECTION,
    });
  }

  return vectorStore;
}

export interface DocumentChunkInput {
  userId: string;
  documentId: string;
  subjectId?: string | null;
  page?: number | null;
  source?: string | null;
  text: string;
}

export interface RetrievedChunk {
  documentId: string;
  page: number | null;
  source: string | null;
  text: string;
  score: number;
}

export function buildChunkFilter(
  userId: string,
  documentId?: string
): { must: Array<Record<string, unknown>> } {
  const must: Array<Record<string, unknown>> = [
    { key: "userId", match: { value: userId } },
  ];

  if (documentId) {
    must.push({ key: "documentId", match: { value: documentId } });
  }

  return { must };
}

function terms(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9\u00c0-\u024f]+/i)
      .filter((term) => term.length >= 3)
  );
}

export interface RerankOptions {
  enabled: boolean;
  candidates: number;
}

/**
 * Lexical reranking experiment. It keeps the vector score as the main signal and
 * breaks ties using query-term coverage, so it needs no extra model or service.
 */
export function rerankChunks(
  query: string,
  chunks: readonly RetrievedChunk[],
  limit: number
): RetrievedChunk[] {
  const queryTerms = terms(query);
  if (queryTerms.size === 0) {
    return chunks.slice(0, limit);
  }

  return [...chunks]
    .map((chunk) => {
      const chunkTerms = terms(chunk.text);
      let matches = 0;
      for (const term of queryTerms) {
        if (chunkTerms.has(term)) {
          matches += 1;
        }
      }
      const coverage = matches / queryTerms.size;
      return {
        chunk,
        score: chunk.score * 0.7 + coverage * 0.3,
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((entry) => entry.chunk);
}

export interface RetrievalDependencies {
  getVectorStore: () => {
    similaritySearchWithScore: (
      query: string,
      limit: number,
      filter: { must: Array<Record<string, unknown>> }
    ) => Promise<Array<[Document, number]>>;
  };
}

export async function indexDocumentChunks(chunks: DocumentChunkInput[]): Promise<void> {
  if (chunks.length === 0) {
    return;
  }

  await ensureDocumentCollection();

  const documents = chunks.map(
    (chunk) =>
      new Document({
        pageContent: chunk.text,
        metadata: {
          userId: chunk.userId,
          documentId: chunk.documentId,
          subjectId: chunk.subjectId ?? null,
          page: chunk.page ?? null,
          source: chunk.source ?? null,
        },
      })
  );

  await getVectorStore().addDocuments(documents);
}

export async function searchDocumentChunks(
  userId: string,
  query: string,
  options: { limit?: number; documentId?: string } = {},
  deps: RetrievalDependencies = { getVectorStore }
): Promise<RetrievedChunk[]> {
  const limit = options.limit ?? 6;
  const rerank: RerankOptions = {
    enabled: env.QDRANT_RERANK_ENABLED,
    candidates: Math.max(limit, env.QDRANT_RERANK_CANDIDATES),
  };
  const results = await deps
    .getVectorStore()
    .similaritySearchWithScore(
      query,
      rerank.enabled ? rerank.candidates : limit,
      buildChunkFilter(userId, options.documentId)
    );

  const chunks = results
    .filter(([, score]) => score >= env.QDRANT_SCORE_THRESHOLD)
    .map(([document, score]) => ({
      documentId: String(document.metadata.documentId ?? ""),
      page: typeof document.metadata.page === "number" ? document.metadata.page : null,
      source: typeof document.metadata.source === "string" ? document.metadata.source : null,
      text: document.pageContent,
      score,
    }));

  return rerank.enabled ? rerankChunks(query, chunks, limit) : chunks.slice(0, limit);
}

export async function deleteDocumentChunks(
  userId: string,
  documentId: string
): Promise<void> {
  await getVectorStore().delete({
    filter: buildChunkFilter(userId, documentId),
  });
}

export async function deleteUserChunks(userId: string): Promise<void> {
  await getVectorStore().delete({
    filter: buildChunkFilter(userId),
  });
}

export function clearVectorStoreCache(): void {
  vectorStore = null;
  qdrantClient = null;
}
