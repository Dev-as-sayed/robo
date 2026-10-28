-- Document uploads now start pending until object storage confirms the bytes.
ALTER TABLE "Document" ALTER COLUMN "status" SET DEFAULT 'pending';

ALTER TABLE "Document"
    ADD COLUMN "checksum" TEXT,
    ADD COLUMN "pageCount" INTEGER,
    ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "error" TEXT,
    ADD COLUMN "indexedAt" TIMESTAMP(3);

UPDATE "Document" SET "status" = 'indexed' WHERE "status" = 'processed';

CREATE INDEX "Document_status_createdAt_idx" ON "Document"("status", "createdAt");
