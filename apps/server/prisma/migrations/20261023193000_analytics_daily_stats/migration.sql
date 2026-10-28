-- AlterTable
ALTER TABLE "StudySession" ADD COLUMN "subject" TEXT;

-- CreateTable
CREATE TABLE "DailyStats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "studyMinutes" INTEGER NOT NULL DEFAULT 0,
    "completedTasks" INTEGER NOT NULL DEFAULT 0,
    "completedQuizzes" INTEGER NOT NULL DEFAULT 0,
    "quizScoreSum" INTEGER NOT NULL DEFAULT 0,
    "quizScoreCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyStats_userId_date_key" ON "DailyStats"("userId", "date");

-- CreateIndex
CREATE INDEX "DailyStats_userId_date_idx" ON "DailyStats"("userId", "date");

-- AddForeignKey
ALTER TABLE "DailyStats" ADD CONSTRAINT "DailyStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
