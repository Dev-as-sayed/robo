CREATE TYPE "PendingActionKind" AS ENUM ('CALL', 'MESSAGE', 'EMAIL', 'WHATSAPP');
CREATE TYPE "PendingActionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'EXPIRED');

CREATE TABLE "PendingAction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contactId" TEXT,
    "kind" "PendingActionKind" NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientPhone" TEXT,
    "recipientEmail" TEXT,
    "body" TEXT,
    "status" "PendingActionStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PendingAction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PendingAction_id_userId_key" ON "PendingAction"("id", "userId");
CREATE INDEX "PendingAction_userId_status_expiresAt_idx" ON "PendingAction"("userId", "status", "expiresAt");
CREATE INDEX "PendingAction_status_expiresAt_idx" ON "PendingAction"("status", "expiresAt");

ALTER TABLE "PendingAction" ADD CONSTRAINT "PendingAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PendingAction" ADD CONSTRAINT "PendingAction_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
