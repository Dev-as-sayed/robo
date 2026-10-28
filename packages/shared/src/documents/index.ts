import { prisma } from "../lib/prisma";

export const DOCUMENT_STATUSES = [
  "pending",
  "uploaded",
  "parsing",
  "ocr",
  "chunking",
  "embedding",
  "indexed",
  "failed",
] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export interface Document {
  id: string;
  userId: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  s3Key: string | null;
  s3Url: string | null;
  status: string;
  subject: string | null;
  checksum: string | null;
  pageCount: number | null;
  chunkCount: number;
  attempts: number;
  error: string | null;
  embeddingModel: string | null;
  lockedAt: Date | null;
  nextAttemptAt: Date | null;
  indexedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDocumentInput {
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  s3Key: string;
  s3Url?: string | null;
  subject?: string | null;
  checksum?: string | null;
  status?: DocumentStatus;
}

export interface UpdateDocumentInput {
  status?: DocumentStatus;
  s3Url?: string | null;
  subject?: string | null;
  checksum?: string | null;
  pageCount?: number | null;
  chunkCount?: number;
  attempts?: number;
  error?: string | null;
  embeddingModel?: string | null;
  lockedAt?: Date | null;
  nextAttemptAt?: Date | null;
  indexedAt?: Date | null;
}

const documentSelect = {
  id: true,
  userId: true,
  filename: true,
  originalName: true,
  size: true,
  mimeType: true,
  s3Key: true,
  s3Url: true,
  status: true,
  subject: true,
  checksum: true,
  pageCount: true,
  chunkCount: true,
  attempts: true,
  error: true,
  embeddingModel: true,
  lockedAt: true,
  nextAttemptAt: true,
  indexedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function createDocument(
  userId: string,
  input: CreateDocumentInput
): Promise<Document> {
  return prisma.document.create({
    data: {
      userId,
      filename: input.filename,
      originalName: input.originalName,
      size: input.size,
      mimeType: input.mimeType,
      s3Key: input.s3Key,
      s3Url: input.s3Url ?? null,
      status: input.status ?? "pending",
      subject: input.subject ?? null,
      checksum: input.checksum ?? null,
      chunkCount: 0,
    },
    select: documentSelect,
  });
}

export async function getDocuments(userId: string): Promise<Document[]> {
  return prisma.document.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: documentSelect,
  });
}

export async function getDocument(
  userId: string,
  documentId: string
): Promise<Document | null> {
  return prisma.document.findFirst({
    where: { id: documentId, userId },
    select: documentSelect,
  });
}

export async function updateDocument(
  userId: string,
  documentId: string,
  patch: UpdateDocumentInput
): Promise<Document> {
  const current = await prisma.document.findFirst({
    where: { id: documentId, userId },
    select: { id: true },
  });

  if (!current) {
    throw new Error("DOCUMENT_NOT_FOUND");
  }

  const data: UpdateDocumentInput = { ...patch };
  if (patch.status === "indexed" && patch.indexedAt === undefined) {
    data.indexedAt = new Date();
  }

  return prisma.document.update({
    where: { id: documentId },
    data,
    select: documentSelect,
  });
}

export async function deleteDocument(
  userId: string,
  documentId: string
): Promise<Document> {
  const document = await getDocument(userId, documentId);

  if (!document) {
    throw new Error("DOCUMENT_NOT_FOUND");
  }

  await prisma.document.delete({ where: { id: documentId } });
  return document;
}

export async function countDocuments(userId: string): Promise<number> {
  return prisma.document.count({ where: { userId } });
}

export async function sumDocumentBytes(userId: string): Promise<number> {
  const result = await prisma.document.aggregate({
    where: { userId },
    _sum: { size: true },
  });

  return result._sum.size ?? 0;
}
