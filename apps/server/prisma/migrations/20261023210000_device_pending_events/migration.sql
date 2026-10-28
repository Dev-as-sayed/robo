CREATE TABLE "DevicePendingEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "DevicePendingEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DevicePendingEvent_userId_deliveredAt_createdAt_idx" ON "DevicePendingEvent"("userId", "deliveredAt", "createdAt");
