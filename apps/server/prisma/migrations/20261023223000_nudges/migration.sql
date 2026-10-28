CREATE TYPE "NudgeType" AS ENUM ('TASK', 'EXAM', 'STUDY', 'REMINDER');

CREATE TABLE "Nudge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NudgeType" NOT NULL,
    "localDay" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Nudge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Nudge_userId_type_localDay_key" ON "Nudge"("userId", "type", "localDay");
CREATE INDEX "Nudge_userId_localDay_idx" ON "Nudge"("userId", "localDay");

ALTER TABLE "Nudge" ADD CONSTRAINT "Nudge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
