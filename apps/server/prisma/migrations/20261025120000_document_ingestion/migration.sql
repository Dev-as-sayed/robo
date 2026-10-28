-- Ingestion worker bookkeeping: stale-lock recovery, retry backoff and the
-- embedding model that produced the stored vectors.
ALTER TABLE "Document"
    ADD COLUMN "embeddingModel" TEXT,
    ADD COLUMN "lockedAt" TIMESTAMP(3),
    ADD COLUMN "nextAttemptAt" TIMESTAMP(3);

CREATE INDEX "Document_status_nextAttemptAt_idx" ON "Document"("status", "nextAttemptAt");
