import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { countDocuments, sumDocumentBytes, type Document } from "@robo/shared/documents";
import { env } from "../../config/env";
import { AppError } from "../../errors/app-error";
import { isStorageConfigured } from "../../lib/storage";

const EXTENSION_FALLBACKS: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
  "text/plain": ".txt",
  "text/markdown": ".md",
  "image/jpeg": ".jpg",
  "image/png": ".png",
};

export function normalizeMimeType(mimeType: string): string {
  return mimeType.split(";")[0]!.trim().toLowerCase();
}

export function allowedMimeTypes(): string[] {
  return env.DOCUMENT_ALLOWED_MIME_TYPES.split(",")
    .map((value) => normalizeMimeType(value))
    .filter(Boolean);
}

export function assertStorageConfigured(): void {
  if (!isStorageConfigured()) {
    throw new AppError(
      "Document storage is not configured on the server.",
      { statusCode: 503, code: "STORAGE_NOT_CONFIGURED" }
    );
  }
}

export function assertAllowedMimeType(mimeType: string): string {
  const normalized = normalizeMimeType(mimeType);
  if (!allowedMimeTypes().includes(normalized)) {
    throw new AppError(
      "This file type is not supported. Upload a PDF, DOCX, PPTX, text, markdown or image file.",
      { statusCode: 415, code: "DOCUMENT_TYPE_NOT_ALLOWED", details: { allowed: allowedMimeTypes() } }
    );
  }

  return normalized;
}

export function assertFileSize(size: number): void {
  if (size <= 0) {
    throw new AppError("The uploaded file is empty.", {
      statusCode: 400,
      code: "DOCUMENT_EMPTY",
    });
  }

  if (size > env.DOCUMENT_MAX_FILE_BYTES) {
    throw new AppError(
      `Files must be ${Math.floor(env.DOCUMENT_MAX_FILE_BYTES / (1024 * 1024))} MB or smaller.`,
      { statusCode: 413, code: "DOCUMENT_TOO_LARGE" }
    );
  }
}

export async function assertDocumentQuota(userId: string, incomingBytes: number): Promise<void> {
  const [documentCount, usedBytes] = await Promise.all([
    countDocuments(userId),
    sumDocumentBytes(userId),
  ]);

  if (documentCount >= env.DOCUMENT_USER_QUOTA_COUNT) {
    throw new AppError(
      `You can store up to ${env.DOCUMENT_USER_QUOTA_COUNT} documents. Delete one before uploading.`,
      { statusCode: 413, code: "DOCUMENT_QUOTA_EXCEEDED", details: { limit: "count" } }
    );
  }

  if (usedBytes + incomingBytes > env.DOCUMENT_USER_QUOTA_BYTES) {
    const limitMb = Math.floor(env.DOCUMENT_USER_QUOTA_BYTES / (1024 * 1024));
    throw new AppError(
      `This upload would exceed your ${limitMb} MB document storage quota.`,
      { statusCode: 413, code: "DOCUMENT_QUOTA_EXCEEDED", details: { limit: "bytes" } }
    );
  }
}

function safeName(originalName: string): string {
  const base = path.basename(originalName).replace(/[^\w.\- ]+/g, "_").trim();
  return (base || "document").slice(-120);
}

export function buildDocumentStorageKey(userId: string, originalName: string): string {
  return `documents/${userId}/${randomUUID()}-${safeName(originalName)}`;
}

export function buildFallbackFilename(originalName: string, mimeType: string): string {
  const base = safeName(originalName);
  return path.extname(base) ? base : `${base}${EXTENSION_FALLBACKS[normalizeMimeType(mimeType)] ?? ""}`;
}

export function checksumBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export interface DocumentResponse extends Omit<Document, "s3Key" | "s3Url"> {
  downloadUrl: string | null;
  downloadUrlExpiresAt: string | null;
}

export function toDocumentResponse(
  document: Document,
  download: { url: string; expiresAt: Date } | null
): DocumentResponse {
  const { s3Key: _s3Key, s3Url: _s3Url, ...rest } = document;

  return {
    ...rest,
    downloadUrl: download?.url ?? null,
    downloadUrlExpiresAt: download?.expiresAt.toISOString() ?? null,
  };
}
