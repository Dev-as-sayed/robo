ALTER TABLE "ScheduleEntry" ADD COLUMN "notePromptedAt" TIMESTAMP(3);
CREATE INDEX "ScheduleEntry_notePromptedAt_endAt_idx" ON "ScheduleEntry"("notePromptedAt", "endAt");

CREATE TABLE "ClassNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scheduleEntryId" TEXT,
    "subject" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "classAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClassNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClassNote_id_userId_key" ON "ClassNote"("id", "userId");
CREATE INDEX "ClassNote_userId_classAt_idx" ON "ClassNote"("userId", "classAt");
CREATE INDEX "ClassNote_scheduleEntryId_idx" ON "ClassNote"("scheduleEntryId");

ALTER TABLE "ClassNote" ADD CONSTRAINT "ClassNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassNote" ADD CONSTRAINT "ClassNote_scheduleEntryId_fkey" FOREIGN KEY ("scheduleEntryId") REFERENCES "ScheduleEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
