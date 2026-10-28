-- CreateEnum
CREATE TYPE "ConsentKind" AS ENUM ('MICROPHONE', 'CONTACTS', 'DOCUMENTS', 'CLOUD_AI');

-- CreateTable
CREATE TABLE "UserConsent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "ConsentKind" NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "policyVersion" TEXT NOT NULL DEFAULT '2026-10',
    "source" TEXT,
    "grantedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserConsent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserConsent_userId_kind_key" ON "UserConsent"("userId", "kind");

-- CreateIndex
CREATE INDEX "UserConsent_userId_granted_idx" ON "UserConsent"("userId", "granted");

-- AddForeignKey
ALTER TABLE "UserConsent" ADD CONSTRAINT "UserConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
