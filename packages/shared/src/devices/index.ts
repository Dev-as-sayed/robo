import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

export type DeviceStatus = "PENDING" | "ONLINE" | "OFFLINE" | "REVOKED";

export interface Device {
  id: string;
  deviceId: string;
  name: string | null;
  firmwareVersion: string | null;
  locale: string | null;
  status: DeviceStatus;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const PAIRING_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PAIRING_CODE_LENGTH = 8;
const DEFAULT_PAIRING_TTL_MINUTES = 10;

const deviceSelect = {
  id: true,
  deviceId: true,
  name: true,
  firmwareVersion: true,
  locale: true,
  status: true,
  lastSeenAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

function toPublicDevice(device: Device): Device {
  return {
    id: device.id,
    deviceId: device.deviceId,
    name: device.name,
    firmwareVersion: device.firmwareVersion,
    locale: device.locale,
    status: device.status,
    lastSeenAt: device.lastSeenAt,
    createdAt: device.createdAt,
    updatedAt: device.updatedAt,
  };
}

function normalizePairingCode(code: string): string {
  return code.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

function hashPairingCode(code: string): string {
  return createHash("sha256").update(normalizePairingCode(code)).digest("hex");
}

export function hashDeviceToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generatePairingCode(): string {
  let raw = "";
  for (let index = 0; index < PAIRING_CODE_LENGTH; index += 1) {
    raw += PAIRING_ALPHABET[randomInt(PAIRING_ALPHABET.length)];
  }
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

function pairingTtlMs(): number {
  const minutes = Number(process.env.PAIRING_CODE_TTL_MINUTES ?? DEFAULT_PAIRING_TTL_MINUTES);
  const validMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_PAIRING_TTL_MINUTES;
  return validMinutes * 60_000;
}

export async function createPairingCode(userId: string) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + pairingTtlMs());

  await prisma.devicePairingCode.deleteMany({
    where: { userId, usedAt: null },
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = generatePairingCode();

    try {
      await prisma.devicePairingCode.create({
        data: {
          userId,
          codeHash: hashPairingCode(code),
          expiresAt,
        },
      });

      return {
        code,
        expiresAt,
        qrPayload: `robo://pair?code=${encodeURIComponent(code)}`,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        continue;
      }
      throw error;
    }
  }

  throw new Error("PAIRING_CODE_GENERATION_FAILED");
}

export async function pairDevice(input: {
  code: string;
  deviceId: string;
  name?: string;
  firmwareVersion?: string;
  locale?: string;
}) {
  const now = new Date();
  const pairingCode = await prisma.devicePairingCode.findUnique({
    where: { codeHash: hashPairingCode(input.code) },
  });

  if (!pairingCode || pairingCode.usedAt) {
    throw new Error("INVALID_PAIRING_CODE");
  }

  if (pairingCode.expiresAt.getTime() <= now.getTime()) {
    throw new Error("PAIRING_CODE_EXPIRED");
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashDeviceToken(token);

  const device = await prisma.$transaction(async (tx) => {
    const claimed = await tx.devicePairingCode.updateMany({
      where: {
        id: pairingCode.id,
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    });

    if (claimed.count === 0) {
      throw new Error("INVALID_PAIRING_CODE");
    }

    const existing = await tx.device.findUnique({
      where: { deviceId: input.deviceId },
    });

    if (existing && existing.userId !== pairingCode.userId) {
      throw new Error("DEVICE_ALREADY_PAIRED");
    }

    const data = {
      tokenHash,
      name: input.name ?? existing?.name ?? null,
      firmwareVersion: input.firmwareVersion ?? existing?.firmwareVersion ?? null,
      locale: input.locale ?? existing?.locale ?? null,
      status: "ONLINE" as const,
      lastSeenAt: now,
    };

    if (existing) {
      return tx.device.update({
        where: { id: existing.id },
        data,
        select: deviceSelect,
      });
    }

    return tx.device.create({
      data: {
        ...data,
        deviceId: input.deviceId,
        userId: pairingCode.userId,
      },
      select: deviceSelect,
    });
  });

  return { device: toPublicDevice(device), token };
}

export async function getDevices(userId: string) {
  const devices = await prisma.device.findMany({
    where: { userId },
    select: deviceSelect,
    orderBy: { createdAt: "asc" },
  });

  return devices.map(toPublicDevice);
}

export async function updateDevice(
  userId: string,
  id: string,
  data: { name?: string; locale?: string }
) {
  const existing = await prisma.device.findFirst({
    where: { id, userId },
    select: { id: true, status: true },
  });

  if (!existing) {
    throw new Error("DEVICE_NOT_FOUND");
  }

  if (existing.status === "REVOKED") {
    throw new Error("DEVICE_REVOKED");
  }

  const device = await prisma.device.update({
    where: { id: existing.id },
    data,
    select: deviceSelect,
  });

  return toPublicDevice(device);
}

export async function revokeDevice(userId: string, id: string) {
  const existing = await prisma.device.findFirst({
    where: { id, userId },
    select: { id: true },
  });

  if (!existing) {
    throw new Error("DEVICE_NOT_FOUND");
  }

  const device = await prisma.device.update({
    where: { id: existing.id },
    data: {
      status: "REVOKED",
      tokenHash: null,
    },
    select: deviceSelect,
  });

  return toPublicDevice(device);
}

export async function factoryResetDevice(userId: string, id: string) {
  const existing = await prisma.device.findFirst({
    where: { id, userId },
    select: { id: true },
  });

  if (!existing) {
    throw new Error("DEVICE_NOT_FOUND");
  }

  const device = await prisma.device.update({
    where: { id: existing.id },
    data: {
      status: "PENDING",
      tokenHash: null,
      name: null,
      firmwareVersion: null,
      locale: null,
      lastSeenAt: null,
    },
    select: deviceSelect,
  });

  return toPublicDevice(device);
}

export interface AuthenticatedDevice {
  userId: string;
  device: Device;
}

export async function authenticateDeviceToken(
  deviceId: string,
  token: string,
  metadata: { firmwareVersion?: string; locale?: string } = {}
): Promise<AuthenticatedDevice> {
  const existing = await prisma.device.findUnique({
    where: { deviceId },
  });

  if (existing?.status === "REVOKED") {
    throw new Error("DEVICE_REVOKED");
  }

  if (!existing || !existing.tokenHash) {
    throw new Error("DEVICE_UNAUTHORIZED");
  }

  const expected = Buffer.from(existing.tokenHash, "hex");
  const actual = Buffer.from(hashDeviceToken(token), "hex");

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error("DEVICE_UNAUTHORIZED");
  }

  const device = await prisma.device.update({
    where: { id: existing.id },
    data: {
      status: "ONLINE",
      lastSeenAt: new Date(),
      ...(metadata.firmwareVersion ? { firmwareVersion: metadata.firmwareVersion } : {}),
      ...(metadata.locale ? { locale: metadata.locale } : {}),
    },
    select: deviceSelect,
  });

  return { userId: existing.userId, device: toPublicDevice(device) };
}

export async function markDevicePresence(
  deviceId: string,
  status: "ONLINE" | "OFFLINE"
): Promise<void> {
  await prisma.device.updateMany({
    where: { deviceId, status: { not: "REVOKED" } },
    data: {
      status,
      ...(status === "ONLINE" ? { lastSeenAt: new Date() } : {}),
    },
  });
}

export async function touchDeviceLastSeen(deviceId: string): Promise<void> {
  await prisma.device.updateMany({
    where: { deviceId, status: "ONLINE" },
    data: { lastSeenAt: new Date() },
  });
}
