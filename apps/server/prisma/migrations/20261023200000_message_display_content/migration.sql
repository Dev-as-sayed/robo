-- Structured display payload stored alongside the spoken/text reply.
ALTER TABLE "Message" ADD COLUMN "displayContent" JSONB;
