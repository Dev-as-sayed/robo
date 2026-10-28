import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  actionLog: { deleteMany: vi.fn() },
  message: { deleteMany: vi.fn() },
  conversation: { deleteMany: vi.fn() },
  reminderDelivery: { deleteMany: vi.fn() },
  nudge: { deleteMany: vi.fn() },
  pendingAction: { deleteMany: vi.fn() },
  refreshToken: { deleteMany: vi.fn() },
  devicePendingEvent: { deleteMany: vi.fn() },
}));

vi.mock("@robo/shared/lib/prisma", () => ({ prisma: db }));

const { runDataCleanup } = await import("@robo/shared/maintenance");
const { DataCleanupJob } = await import(
  "../src/modules/maintenance/cleanup-job"
);

const NOW = new Date("2026-10-23T12:00:00.000Z");
const CUTOFF = new Date("2026-07-25T12:00:00.000Z");

describe("runDataCleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const model of Object.values(db)) {
      model.deleteMany.mockResolvedValue({ count: 1 });
    }
  });

  it("deletes rows older than the 90-day retention window", async () => {
    const counts = await runDataCleanup({
      now: NOW,
      retentionDays: 90,
      removeOrphans: async () => ({ files: 2, vectors: 3 }),
    });

    expect(db.actionLog.deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: CUTOFF } },
    });
    expect(db.message.deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: CUTOFF } },
    });
    expect(db.conversation.deleteMany).toHaveBeenCalledWith({
      where: { updatedAt: { lt: CUTOFF }, messages: { none: {} } },
    });
    expect(db.pendingAction.deleteMany).toHaveBeenCalledWith({
      where: {
        updatedAt: { lt: CUTOFF },
        status: { in: ["CONFIRMED", "REJECTED", "EXPIRED"] },
      },
    });
    expect(counts).toEqual({
      actionLogs: 1,
      messages: 1,
      conversations: 1,
      reminderDeliveries: 1,
      nudges: 1,
      pendingActions: 1,
      refreshTokens: 1,
      deviceEvents: 1,
      orphanFiles: 2,
      orphanVectors: 3,
    });
  });

  it("clamps a non-positive retention window", async () => {
    await runDataCleanup({ now: NOW, retentionDays: 0 });
    const cutoff = db.actionLog.deleteMany.mock.calls[0]?.[0].where.createdAt.lt;

    expect(cutoff).toEqual(new Date(NOW.getTime() - 24 * 60 * 60_000));
  });

  it("job runs cleanup with the configured retention", async () => {
    const run = vi.fn().mockResolvedValue({ actionLogs: 4 });
    const job = new DataCleanupJob({
      retentionDays: 30,
      run,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      } as never,
    });

    await expect(job.tick(NOW)).resolves.toEqual({ actionLogs: 4 });
    expect(run).toHaveBeenCalledWith({ retentionDays: 30, now: NOW });
  });
});
