import { updateDocument } from "@robo/shared/documents";
import { env } from "../../config/env";
import { getStorageObject } from "../../lib/storage";
import { deleteDocumentChunks, indexDocumentChunks } from "../ai/qdrant";
import { chunkPages } from "./chunk";
import { ingestDocument, type IngestionResult } from "./ingestion";
import { parseDocument } from "./parsers";

/** Wires the pure ingestion pipeline to PostgreSQL, object storage and Qdrant. */
export function createDocumentIngestionRunner(): (
  document: Parameters<typeof ingestDocument>[0]
) => Promise<IngestionResult> {
  return (document) =>
    ingestDocument(document, {
      updateDocument,
      readObject: getStorageObject,
      parse: parseDocument,
      chunk: chunkPages,
      removeChunks: deleteDocumentChunks,
      indexChunks: indexDocumentChunks,
      embeddingModel: env.EMBEDDING_MODEL,
      chunkOptions: {
        maxChars: env.DOCUMENT_CHUNK_MAX_CHARS,
        overlapChars: env.DOCUMENT_CHUNK_OVERLAP_CHARS,
      },
      pdfMinTextChars: env.DOCUMENT_PDF_MIN_TEXT_CHARS,
    });
}
