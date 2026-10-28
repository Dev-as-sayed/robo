import { describe, expect, it, vi } from "vitest";
import type { FailedDeliveryRetry } from "@robo/shared/reminders";
import { retryDueReminderDeliveries } from "../src/modules/reminders/delivery-retry";

const dueAt = new Date("2026-10-23T18:00:00.000Z");
const now = new Date("2026-10-23T18:02:00.000Z");

function failure(overrides: Partial<FailedDeliveryRetry> = {}): FailedDeliveryRetry {
  return {
    id: "delivery-1",
    reminderId: "reminder-1",
    userId: "user-1",
    dueAt,
    channel: "device",
    attempts: 1,
    ...overrides,
  };
}

describe("retryDueReminderDeliveries", () => {
  it("marks a retried device delivery as sent when a socket is online", async () => {
    const record = vi.fn().mockResolvedValue(undefined);
    const notifyUser = vi.fn().mockReturnValue(1);

    await expect(
      retryDueReminderDeliveries(now, {
        list: async () => [failure()],
        getReminders: async () => [{ id: "reminder-1", userId: "user-1", text: "Stretch" }],
        record,
        notifyUser,
      })
    ).resolves.toBe(1);

    expect(notifyUser).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ type: "reminder.fire", reminderId: "reminder-1" })
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "device", status: "SENT", error: null })
    );
  });

  it("retries a push delivery through Expo", async () => {
    const record = vi.fn().mockResolvedValue(undefined);
    const push = vi.fn().mockResolvedValue({ sent: 1, failed: 0 });

    await expect(
      retryDueReminderDeliveries(now, {
        list: async () => [failure({ channel: "push" })],
        getReminders: async () => [{ id: "reminder-1", userId: "user-1", text: "Stretch" }],
        record,
        push,
        notifyUser: vi.fn(),
      })
    ).resolves.toBe(1);

    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ reminderId: "reminder-1", dueAt })
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "push", status: "SENT" })
    );
  });

  it("closes a delivery whose reminder was deleted", async () => {
    const record = vi.fn().mockResolvedValue(undefined);

    await retryDueReminderDeliveries(now, {
      list: async () => [failure()],
      getReminders: async () => [],
      record,
      notifyUser: vi.fn(),
    });

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ status: "FAILED", error: "REMINDER_DELETED" })
    );
  });
});
