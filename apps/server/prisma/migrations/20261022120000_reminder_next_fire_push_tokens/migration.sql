-- AlterTable
ALTER TABLE "Reminder" ADD COLUMN "nextAt" TIMESTAMP(3),
ADD COLUMN "lastFiredAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Reminder_status_nextAt_idx" ON "Reminder"("status", "nextAt");

-- Backfill one-time reminders so existing rows can fire. Recurring rows realign
-- on their first claim: the scheduler computes the next occurrence after firing.
UPDATE "Reminder" SET "nextAt" = "at"
WHERE "status" = 'active' AND "nextAt" IS NULL AND "at" IS NOT NULL;

-- CreateTable
CREATE TABLE "PushToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushToken_userId_token_key" ON "PushToken"("userId", "token");

-- CreateIndex
CREATE INDEX "PushToken_userId_idx" ON "PushToken"("userId");

-- AddForeignKey
ALTER TABLE "PushToken" ADD CONSTRAINT "PushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
