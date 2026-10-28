import { prisma } from "../lib/prisma";

export interface CleanupCounts {
  actionLogs: number;
  messages: number;
  conversations: number;
  reminderDeliveries: number;
  nudges: number;
  pendingActions: number;
  refreshTokens: number;
  deviceEvents: number;
  orphanFiles: number;
  orphanVectors: number;
}

export interface CleanupOptions {
  retentionDays?: number;
  now?: Date;
  removeOrphans?: () => Promise<{ files: number; vectors: number }>;
}

/**
 * Removes expired transcripts, action logs and operational rows. Files and vectors are
 * delegated to `removeOrphans`; object storage and Qdrant are not configured yet, so the
 * default reports zero rather than silently deleting anything.
 */
export async function runDataCleanup(
  options: CleanupOptions = {}
): Promise<CleanupCounts> {
  const now = options.now ?? new Date();
  const retentionDays = Math.max(1, options.retentionDays ?? 90);
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60_000);

  const actionLogs = await prisma.actionLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  const messages = await prisma.message.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  const conversations = await prisma.conversation.deleteMany({
    where: { updatedAt: { lt: cutoff }, messages: { none: {} } },
  });
  const reminderDeliveries = await prisma.reminderDelivery.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  const nudges = await prisma.nudge.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  const pendingActions = await prisma.pendingAction.deleteMany({
    where: {
      updatedAt: { lt: cutoff },
      status: { in: ["CONFIRMED", "REJECTED", "EXPIRED"] },
    },
  });
  const refreshTokens = await prisma.refreshToken.deleteMany({
    where: {
      OR: [{ expiresAt: { lt: now } }, { revokedAt: { lt: cutoff } }],
    },
  });
  const deviceEvents = await prisma.devicePendingEvent.deleteMany({
    where: {
      OR: [
        { deliveredAt: { lt: cutoff } },
        { deliveredAt: null, createdAt: { lt: cutoff } },
      ],
    },
  });

  const orphans = options.removeOrphans
    ? await options.removeOrphans()
    : { files: 0, vectors: 0 };

  return {
    actionLogs: actionLogs.count,
    messages: messages.count,
    conversations: conversations.count,
    reminderDeliveries: reminderDeliveries.count,
    nudges: nudges.count,
    pendingActions: pendingActions.count,
    refreshTokens: refreshTokens.count,
    deviceEvents: deviceEvents.count,
    orphanFiles: orphans.files,
    orphanVectors: orphans.vectors,
  };
}
