ALTER TABLE "StudyPlan" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "StudyPlan" ADD COLUMN "reminderId" TEXT;
ALTER TABLE "DailyTask" ADD COLUMN "todoId" TEXT;

CREATE UNIQUE INDEX "DailyTask_todoId_key" ON "DailyTask"("todoId");

ALTER TABLE "DailyTask" ADD CONSTRAINT "DailyTask_todoId_fkey" FOREIGN KEY ("todoId") REFERENCES "Todo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
