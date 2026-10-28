CREATE TYPE "StudySessionStatus" AS ENUM ('active', 'paused', 'ended');

ALTER TABLE "StudySession" ADD COLUMN "status" "StudySessionStatus" NOT NULL DEFAULT 'active';
ALTER TABLE "StudySession" ADD COLUMN "plannedMinutes" INTEGER;
ALTER TABLE "StudySession" ADD COLUMN "extendedMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "StudySession" ADD COLUMN "pausedAt" TIMESTAMP(3);
ALTER TABLE "StudySession" ADD COLUMN "totalPausedMs" INTEGER NOT NULL DEFAULT 0;

UPDATE "StudySession" SET "status" = 'ended' WHERE "endedAt" IS NOT NULL;
