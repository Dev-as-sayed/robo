import { beforeEach, describe, expect, it, vi } from "vitest";

const countDocuments = vi.hoisted(() => vi.fn());
const sumDocumentBytes = vi.hoisted(() => vi.fn());
const isStorageConfigured = vi.hoisted(() => vi.fn());

vi.mock("@robo/shared/documents", () => ({
  countDocuments,
  sumDocumentBytes,
}));
vi.mock("../src/lib/storage", () => ({ isStorageConfigured }));

const {
  allowedMimeTypes,
  assertAllowedMimeType,
  assertDocumentQuota,
  assertFileSize,
  assertStorageConfigured,
  buildDocumentStorageKey,
  buildFallbackFilename,
  checksumBuffer,
  normalizeMimeType,
  toDocumentResponse,
} = await import("../src/modules/documents/upload");

function thrownCode(run: () => unknown): string | undefined {
  try {
    run();
    return undefined;
  } catch (error) {
    return (error as { code?: string }).code;
  }
}

describe("document upload helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    countDocuments.mockResolvedValue(0);
    sumDocumentBytes.mockResolvedValue(0);
    isStorageConfigured.mockReturnValue(true);
  });

  it("normalizes MIME parameters and allows supported types", () => {
    expect(normalizeMimeType("application/pdf; charset=utf-8")).toBe("application/pdf");
    expect(assertAllowedMimeType("text/markdown; charset=UTF-8")).toBe("text/markdown");
    expect(allowedMimeTypes()).toContain("application/pdf");
  });

  it("rejects unsupported file types", () => {
    expect(thrownCode(() => assertAllowedMimeType("application/x-msdownload"))).toBe(
      "DOCUMENT_TYPE_NOT_ALLOWED"
    );
  });

  it("enforces the per-file size limit", () => {
    expect(thrownCode(() => assertFileSize(0))).toBe("DOCUMENT_EMPTY");
    expect(thrownCode(() => assertFileSize(25 * 1024 * 1024 + 1))).toBe(
      "DOCUMENT_TOO_LARGE"
    );
    expect(() => assertFileSize(25 * 1024 * 1024)).not.toThrow();
  });

  it("rejects uploads over the document count quota", async () => {
    countDocuments.mockResolvedValue(100);

    await expect(assertDocumentQuota("user-1", 10)).rejects.toMatchObject({
      code: "DOCUMENT_QUOTA_EXCEEDED",
    });
  });

  it("rejects uploads over the byte quota", async () => {
    sumDocumentBytes.mockResolvedValue(250 * 1024 * 1024);

    await expect(assertDocumentQuota("user-1", 1)).rejects.toMatchObject({
      code: "DOCUMENT_QUOTA_EXCEEDED",
    });
  });

  it("accepts uploads within the quota", async () => {
    countDocuments.mockResolvedValue(3);
    sumDocumentBytes.mockResolvedValue(1024);

    await expect(assertDocumentQuota("user-1", 1024)).resolves.toBeUndefined();
  });

  it("fails clearly when storage is not configured", () => {
    isStorageConfigured.mockReturnValue(false);

    expect(thrownCode(() => assertStorageConfigured())).toBe(
      "STORAGE_NOT_CONFIGURED"
    );
  });

  it("builds unique, user-scoped storage keys", () => {
    const first = buildDocumentStorageKey("user-1", "../My Notes.pdf");
    const second = buildDocumentStorageKey("user-1", "../My Notes.pdf");

    expect(first).toMatch(/^documents\/user-1\//);
    expect(first).toContain("My Notes.pdf");
    expect(first).not.toContain("..");
    expect(first).not.toBe(second);
  });

  it("adds an extension when the original name has none", () => {
    expect(buildFallbackFilename("lecture", "application/pdf")).toBe(
      "lecture.pdf"
    );
    expect(buildFallbackFilename("notes.md", "text/markdown")).toBe("notes.md");
  });

  it("hashes file bytes with SHA-256", () => {
    expect(checksumBuffer(Buffer.from("hello"))).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
    );
  });

  it("does not expose internal storage keys", () => {
    const response = toDocumentResponse(
      {
        id: "doc-1",
        userId: "user-1",
        filename: "stored.pdf",
        originalName: "notes.pdf",
        size: 10,
        mimeType: "application/pdf",
        s3Key: "documents/user-1/stored.pdf",
        s3Url: null,
        status: "uploaded",
        subject: null,
        checksum: null,
        pageCount: null,
        chunkCount: 0,
        attempts: 0,
        error: null,
        embeddingModel: null,
        lockedAt: null,
        nextAttemptAt: null,
        indexedAt: null,
        createdAt: new Date("2026-10-25T12:00:00Z"),
        updatedAt: new Date("2026-10-25T12:00:00Z"),
      },
      { url: "https://storage.test/signed", expiresAt: new Date("2026-10-25T12:15:00Z") }
    );

    expect(response).not.toHaveProperty("s3Key");
    expect(response).not.toHaveProperty("s3Url");
    expect(response.downloadUrl).toBe("https://storage.test/signed");
  });
});
