CREATE TYPE "ReminderChannel" AS ENUM ('device', 'phone', 'push');

CREATE TYPE "ReminderDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

CREATE TABLE "ReminderDelivery" (
    "id" TEXT NOT NULL,
    "reminderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "channel" "ReminderChannel" NOT NULL,
    "status" "ReminderDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "nextAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReminderDelivery_reminderId_dueAt_channel_key" ON "ReminderDelivery"("reminderId", "dueAt", "channel");
CREATE INDEX "ReminderDelivery_userId_createdAt_idx" ON "ReminderDelivery"("userId", "createdAt");
CREATE INDEX "ReminderDelivery_status_nextAttemptAt_idx" ON "ReminderDelivery"("status", "nextAttemptAt");
