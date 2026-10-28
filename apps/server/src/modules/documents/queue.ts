import type { Document } from "@robo/shared/documents";
import { prisma } from "@robo/shared/lib/prisma";

const IN_PROGRESS_STATUSES = ["parsing", "ocr", "chunking", "embedding"] as const;

export interface ClaimOptions {
  now?: Date;
  staleAfterMs?: number;
}

function claimableWhere(now: Date, staleBefore: Date) {
  return {
    AND: [
      {
        OR: [
          { status: "uploaded" },
          {
            status: { in: [...IN_PROGRESS_STATUSES] },
            OR: [{ lockedAt: null }, { lockedAt: { lt: staleBefore } }],
          },
        ],
      },
      {
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
    ],
  };
}

/**
 * Claims one document for ingestion. The conditional `updateMany` makes the claim
 * atomic across workers: if another worker wins the row, this call retries or returns
 * null instead of processing the same file twice.
 */
export async function claimDocumentForIngestion(
  options: ClaimOptions = {}
): Promise<Document | null> {
  const now = options.now ?? new Date();
  const staleBefore = new Date(now.getTime() - (options.staleAfterMs ?? 15 * 60_000));

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const candidate = await prisma.document.findFirst({
      where: claimableWhere(now, staleBefore),
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, userId: true },
    });

    if (!candidate) {
      return null;
    }

    const claimed = await prisma.document.updateMany({
      where: {
        id: candidate.id,
        ...claimableWhere(now, staleBefore),
      },
      data: {
        status: "parsing",
        lockedAt: now,
        nextAttemptAt: null,
        error: null,
        attempts: { increment: 1 },
      },
    });

    if (claimed.count === 1) {
      return prisma.document.findUnique({
        where: { id: candidate.id },
      });
    }
  }

  return null;
}

export interface FailureOptions {
  now?: Date;
  maxAttempts?: number;
  backoffBaseMs?: number;
}

export async function markIngestionFailure(
  document: Pick<Document, "id" | "userId" | "attempts">,
  error: unknown,
  options: FailureOptions = {}
): Promise<"retry" | "failed"> {
  const now = options.now ?? new Date();
  const attempts = document.attempts;
  const exhausted = attempts >= (options.maxAttempts ?? 3);
  const message =
    error instanceof Error ? error.message : String(error || "INGESTION_FAILED");
  const backoffMs = Math.max(0, options.backoffBaseMs ?? 30_000) * Math.max(1, attempts);

  await prisma.document.updateMany({
    where: { id: document.id, userId: document.userId },
    data: exhausted
      ? {
          status: "failed",
          error: message.slice(0, 1_000),
          lockedAt: null,
          nextAttemptAt: null,
        }
      : {
          status: "uploaded",
          error: message.slice(0, 1_000),
          lockedAt: null,
          nextAttemptAt: new Date(now.getTime() + backoffMs),
        },
  });

  return exhausted ? "failed" : "retry";
}

/** Queues indexed documents whose vectors came from another embedding model. */
export async function queueEmbeddingReindexes(
  embeddingModel: string,
  now = new Date()
): Promise<number> {
  const stale = await prisma.document.findMany({
    where: {
      status: "indexed",
      OR: [{ embeddingModel: null }, { embeddingModel: { not: embeddingModel } }],
    },
    select: { id: true },
    take: 100,
  });

  if (stale.length === 0) {
    return 0;
  }

  const result = await prisma.document.updateMany({
    where: { id: { in: stale.map((document) => document.id) } },
    data: {
      status: "uploaded",
      attempts: 0,
      error: null,
      lockedAt: null,
      nextAttemptAt: now,
      embeddingModel: null,
      indexedAt: null,
    },
  });

  return result.count;
}

/** Resets one document so the worker picks it up again. */
export async function requeueDocument(
  userId: string,
  documentId: string
): Promise<boolean> {
  const result = await prisma.document.updateMany({
    where: { id: documentId, userId },
    data: {
      status: "uploaded",
      attempts: 0,
      error: null,
      lockedAt: null,
      nextAttemptAt: new Date(),
      embeddingModel: null,
      indexedAt: null,
    },
  });

  return result.count === 1;
}
