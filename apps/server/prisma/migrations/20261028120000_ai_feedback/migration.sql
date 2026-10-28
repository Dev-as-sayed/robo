CREATE TYPE "AiFeedbackSurface" AS ENUM ('CHAT', 'VISION');
CREATE TYPE "AiFeedbackReason" AS ENUM ('OFFENSIVE', 'UNSAFE', 'INCORRECT', 'OTHER');
CREATE TYPE "AiFeedbackStatus" AS ENUM ('OPEN', 'REVIEWED', 'DISMISSED');

CREATE TABLE "AiFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "surface" "AiFeedbackSurface" NOT NULL,
    "messageId" TEXT,
    "responseText" TEXT,
    "reason" "AiFeedbackReason" NOT NULL,
    "details" TEXT,
    "status" "AiFeedbackStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiFeedback_messageId_idx" ON "AiFeedback"("messageId");
CREATE INDEX "AiFeedback_status_createdAt_idx" ON "AiFeedback"("status", "createdAt");
CREATE INDEX "AiFeedback_userId_createdAt_idx" ON "AiFeedback"("userId", "createdAt");

ALTER TABLE "AiFeedback" ADD CONSTRAINT "AiFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiFeedback" ADD CONSTRAINT "AiFeedback_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
