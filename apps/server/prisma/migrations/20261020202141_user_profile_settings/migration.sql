-- AlterTable
ALTER TABLE "User" ADD COLUMN     "guardianConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nudgeSettings" JSONB,
ADD COLUMN     "wakePhrase" TEXT NOT NULL DEFAULT 'hey robo';
