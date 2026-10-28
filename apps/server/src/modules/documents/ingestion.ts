import type { Document } from "@robo/shared/documents";
import type { DocumentChunkInput } from "../ai/qdrant";
import { chunkPages, type ChunkOptions } from "./chunk";
import { parseDocument, type ParseDocumentOptions } from "./parsers";

export interface IngestionDependencies {
  updateDocument: (
    userId: string,
    documentId: string,
    patch: {
      status?: "parsing" | "ocr" | "chunking" | "embedding" | "indexed" | "failed";
      pageCount?: number;
      chunkCount?: number;
      error?: string | null;
      embeddingModel?: string | null;
      lockedAt?: Date | null;
      nextAttemptAt?: Date | null;
      indexedAt?: Date | null;
    }
  ) => Promise<unknown>;
  readObject: (key: string) => Promise<{ body: Buffer; contentType: string | null }>;
  parse: typeof parseDocument;
  chunk: typeof chunkPages;
  removeChunks: (userId: string, documentId: string) => Promise<void>;
  indexChunks: (chunks: DocumentChunkInput[]) => Promise<void>;
  embeddingModel: string;
  chunkOptions: ChunkOptions;
  pdfMinTextChars: number;
}

export interface IngestionResult {
  pageCount: number;
  chunkCount: number;
  usedOcr: boolean;
}

/**
 * Turns an uploaded document into indexed vectors. Status transitions are persisted
 * after every stage so the app can show progress and a crashed worker can be retried.
 */
export async function ingestDocument(
  document: Document,
  deps: IngestionDependencies
): Promise<IngestionResult> {
  if (!document.s3Key) {
    throw new Error("DOCUMENT_STORAGE_KEY_MISSING");
  }

  await deps.updateDocument(document.userId, document.id, {
    status: "parsing",
    error: null,
    lockedAt: new Date(),
    nextAttemptAt: null,
  });

  const stored = await deps.readObject(document.s3Key);
  const parseOptions: ParseDocumentOptions = {
    mimeType: document.mimeType,
    filename: document.originalName,
    pdfMinTextChars: deps.pdfMinTextChars,
  };
  const parsed = await deps.parse(stored.body, parseOptions);

  if (parsed.pages.length === 0) {
    throw new Error("DOCUMENT_NO_TEXT");
  }

  await deps.updateDocument(document.userId, document.id, {
    status: parsed.usedOcr ? "ocr" : "chunking",
    pageCount: parsed.pageCount,
  });

  const chunks = deps.chunk(parsed.pages, deps.chunkOptions);
  if (chunks.length === 0) {
    throw new Error("DOCUMENT_NO_CHUNKS");
  }

  await deps.updateDocument(document.userId, document.id, {
    status: "embedding",
    pageCount: parsed.pageCount,
  });

  await deps.removeChunks(document.userId, document.id);
  await deps.indexChunks(
    chunks.map((chunk) => ({
      userId: document.userId,
      documentId: document.id,
      subjectId: document.subject,
      page: chunk.page,
      source: document.originalName,
      text: chunk.text,
    }))
  );

  const indexedAt = new Date();
  await deps.updateDocument(document.userId, document.id, {
    status: "indexed",
    pageCount: parsed.pageCount,
    chunkCount: chunks.length,
    embeddingModel: deps.embeddingModel,
    error: null,
    lockedAt: null,
    nextAttemptAt: null,
    indexedAt,
  });

  return {
    pageCount: parsed.pageCount,
    chunkCount: chunks.length,
    usedOcr: parsed.usedOcr,
  };
}
