-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('PENDING', 'ONLINE', 'OFFLINE', 'REVOKED');

-- DropIndex
DROP INDEX "Device_deviceId_userId_key";

-- AlterTable
ALTER TABLE "Device" RENAME COLUMN "token" TO "tokenHash";
ALTER TABLE "Device" RENAME COLUMN "lastSeen" TO "lastSeenAt";
ALTER TABLE "Device" ADD COLUMN "name" TEXT;
ALTER TABLE "Device" ALTER COLUMN "tokenHash" DROP NOT NULL;
ALTER TABLE "Device" ALTER COLUMN "lastSeenAt" DROP DEFAULT;
ALTER TABLE "Device" ALTER COLUMN "lastSeenAt" DROP NOT NULL;
ALTER TABLE "Device" ADD COLUMN "status_new" "DeviceStatus" NOT NULL DEFAULT 'PENDING';
UPDATE "Device"
SET "status_new" = CASE UPPER("status")
  WHEN 'ONLINE' THEN 'ONLINE'::"DeviceStatus"
  WHEN 'OFFLINE' THEN 'OFFLINE'::"DeviceStatus"
  WHEN 'REVOKED' THEN 'REVOKED'::"DeviceStatus"
  ELSE 'PENDING'::"DeviceStatus"
END;
ALTER TABLE "Device" DROP COLUMN "status";
ALTER TABLE "Device" RENAME COLUMN "status_new" TO "status";

-- CreateTable
CREATE TABLE "DevicePairingCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DevicePairingCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DevicePairingCode_codeHash_key" ON "DevicePairingCode"("codeHash");

-- CreateIndex
CREATE INDEX "DevicePairingCode_userId_usedAt_idx" ON "DevicePairingCode"("userId", "usedAt");

-- CreateIndex
CREATE INDEX "DevicePairingCode_expiresAt_idx" ON "DevicePairingCode"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Device_tokenHash_key" ON "Device"("tokenHash");

-- CreateIndex
CREATE INDEX "Device_status_idx" ON "Device"("status");

-- AddForeignKey
ALTER TABLE "DevicePairingCode" ADD CONSTRAINT "DevicePairingCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
