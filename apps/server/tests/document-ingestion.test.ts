import type { Document } from "@robo/shared/documents";
import { describe, expect, it, vi } from "vitest";
import { ingestDocument } from "../src/modules/documents/ingestion";

function document(overrides: Partial<Document> = {}): Document {
  return {
    id: "doc-1",
    userId: "user-1",
    filename: "notes.txt",
    originalName: "notes.txt",
    size: 20,
    mimeType: "text/plain",
    s3Key: "documents/user-1/notes.txt",
    s3Url: null,
    status: "parsing",
    subject: "Biology",
    checksum: null,
    pageCount: null,
    chunkCount: 0,
    attempts: 1,
    error: null,
    embeddingModel: null,
    lockedAt: null,
    nextAttemptAt: null,
    indexedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function deps(overrides: Record<string, unknown> = {}) {
  const updateDocument = vi.fn().mockResolvedValue({});
  const readObject = vi.fn().mockResolvedValue({
    body: Buffer.from("Photosynthesis converts light into energy."),
    contentType: "text/plain",
  });
  const removeChunks = vi.fn().mockResolvedValue(undefined);
  const indexChunks = vi.fn().mockResolvedValue(undefined);

  return {
    updateDocument,
    readObject,
    removeChunks,
    indexChunks,
    parse: vi.fn().mockResolvedValue({
      pages: [{ page: 1, text: "Photosynthesis converts light into energy.", ocr: false }],
      pageCount: 1,
      usedOcr: false,
    }),
    chunk: vi.fn().mockReturnValue([
      { page: 1, text: "Photosynthesis converts light into energy." },
    ]),
    embeddingModel: "bge-m3",
    chunkOptions: { maxChars: 1_800, overlapChars: 200 },
    pdfMinTextChars: 40,
    ...overrides,
  };
}

describe("document ingestion", () => {
  it("moves through parsing, chunking, embedding and indexed", async () => {
    const dependencies = deps();
    const result = await ingestDocument(document(), dependencies);

    const statuses = dependencies.updateDocument.mock.calls.map(
      ([, , patch]) => (patch as { status?: string }).status
    );
    expect(statuses).toEqual(["parsing", "chunking", "embedding", "indexed"]);
    expect(dependencies.removeChunks).toHaveBeenCalledWith("user-1", "doc-1");
    expect(dependencies.indexChunks).toHaveBeenCalledWith([
      {
        userId: "user-1",
        documentId: "doc-1",
        subjectId: "Biology",
        page: 1,
        source: "notes.txt",
        text: "Photosynthesis converts light into energy.",
      },
    ]);
    expect(dependencies.updateDocument).toHaveBeenLastCalledWith(
      "user-1",
      "doc-1",
      expect.objectContaining({
        status: "indexed",
        chunkCount: 1,
        embeddingModel: "bge-m3",
        indexedAt: expect.any(Date),
      })
    );
    expect(result).toEqual({ pageCount: 1, chunkCount: 1, usedOcr: false });
  });

  it("marks OCR status when a page needed OCR", async () => {
    const dependencies = deps({
      parse: vi.fn().mockResolvedValue({
        pages: [{ page: 1, text: "Scanned text", ocr: true }],
        pageCount: 1,
        usedOcr: true,
      }),
    });

    await ingestDocument(document({ mimeType: "image/png" }), dependencies);

    expect(
      dependencies.updateDocument.mock.calls.map(
        ([, , patch]) => (patch as { status?: string }).status
      )
    ).toContain("ocr");
  });

  it("rejects documents with no extractable text", async () => {
    const dependencies = deps({
      parse: vi.fn().mockResolvedValue({ pages: [], pageCount: 2, usedOcr: false }),
    });

    await expect(ingestDocument(document(), dependencies)).rejects.toThrow(
      "DOCUMENT_NO_TEXT"
    );
    expect(dependencies.indexChunks).not.toHaveBeenCalled();
  });

  it("does not touch vectors when the storage read fails", async () => {
    const dependencies = deps({
      readObject: vi.fn().mockRejectedValue(new Error("STORAGE_READ_FAILED")),
    });

    await expect(ingestDocument(document(), dependencies)).rejects.toThrow(
      "STORAGE_READ_FAILED"
    );
    expect(dependencies.removeChunks).not.toHaveBeenCalled();
    expect(dependencies.indexChunks).not.toHaveBeenCalled();
  });
});
