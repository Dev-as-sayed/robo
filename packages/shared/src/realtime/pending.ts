import { prisma } from "../lib/prisma";
import type { DeviceServerMessage } from "./index";

export interface PendingDeviceEvent {
  id: string;
  message: DeviceServerMessage;
}

/** Stores one server message for a user whose speaker is offline. */
export async function enqueueDeviceEvent(
  userId: string,
  message: DeviceServerMessage
): Promise<void> {
  await prisma.devicePendingEvent.create({
    data: {
      userId,
      message: message as unknown as object,
    },
  });
}

/**
 * Claims up to `limit` undelivered messages for a reconnecting device. Claiming before
 * sending avoids replay loops if the socket drops mid-flush; the trade-off is a lost
 * message rather than a duplicate.
 */
export async function takePendingDeviceEvents(
  userId: string,
  limit = 20
): Promise<PendingDeviceEvent[]> {
  const rows = await prisma.devicePendingEvent.findMany({
    where: { userId, deliveredAt: null },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit,
    select: { id: true, message: true },
  });

  if (rows.length === 0) {
    return [];
  }

  await prisma.devicePendingEvent.updateMany({
    where: { id: { in: rows.map((row) => row.id) }, deliveredAt: null },
    data: { deliveredAt: new Date() },
  });

  return rows.map((row) => ({
    id: row.id,
    message: row.message as unknown as DeviceServerMessage,
  }));
}
