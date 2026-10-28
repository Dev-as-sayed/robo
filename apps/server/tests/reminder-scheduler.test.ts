import { describe, expect, it, vi, type Mock } from "vitest";
import type { DueReminder } from "@robo/shared/reminders";
import { createReminderNotifier } from "../src/modules/reminders/notify";
import { ReminderScheduler } from "../src/modules/reminders/scheduler";

const DUE_AT = new Date("2026-10-22T10:00:00.000Z");

function due(overrides: Partial<DueReminder> = {}): DueReminder {
  return {
    id: "reminder-1",
    userId: "user-1",
    timezone: "Asia/Kolkata",
    text: "Stretch break",
    at: DUE_AT,
    rrule: null,
    channels: ["device"],
    linkedEntity: null,
    dueAt: DUE_AT,
    firedAt: DUE_AT,
    ...overrides,
  };
}

interface SpyLogger {
  info: Mock;
  warn: Mock;
  error: Mock;
  debug: Mock;
}

function silentLogger(): SpyLogger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
}

function deliverTo(...channels: string[]): (due: DueReminder) => string[] {
  return (): string[] => channels;
}

describe("ReminderScheduler", () => {
  it("delivers every claimed reminder and counts the ones that landed", async () => {
    const items = [due({ id: "a" }), due({ id: "b" }), due({ id: "c" })];
    const deliver = vi
      .fn()
      .mockImplementation(
        async (reminder: DueReminder): Promise<string[]> => (reminder.id === "b" ? [] : ["device"])
      );
    const scheduler = new ReminderScheduler({
      deliver,
      claim: async (): Promise<DueReminder[]> => items,
      logger: silentLogger(),
    });

    const summary = await scheduler.tick(new Date(DUE_AT.getTime() + 5_000));

    expect(deliver).toHaveBeenCalledTimes(3);
    expect(summary).toMatchObject({ claimed: 3, delivered: 2 });
  });

  it("reports the worst gap between the due slot and the tick", async () => {
    const items = [
      due({ id: "on-time", dueAt: DUE_AT }),
      due({ id: "stale", dueAt: new Date(DUE_AT.getTime() - 20_000) }),
    ];
    const scheduler = new ReminderScheduler({
      deliver: deliverTo("device"),
      claim: async (): Promise<DueReminder[]> => items,
      logger: silentLogger(),
    });

    const summary = await scheduler.tick(DUE_AT);

    expect(summary.maxLatencyMs).toBe(20_000);
  });

  it("keeps delivering after one channel throws", async () => {
    const delivered: string[] = [];
    const scheduler = new ReminderScheduler({
      deliver: (reminder): string[] => {
        if (reminder.id === "boom") {
          throw new Error("socket closed");
        }

        delivered.push(reminder.id);
        return ["device"];
      },
      claim: async (): Promise<DueReminder[]> => [
        due({ id: "before" }),
        due({ id: "boom" }),
        due({ id: "after" }),
      ],
      logger: silentLogger(),
    });

    const summary = await scheduler.tick(DUE_AT);

    expect(delivered).toEqual(["before", "after"]);
    expect(summary).toMatchObject({ claimed: 3, delivered: 2 });
  });

  it("shares one pass between overlapping ticks", async () => {
    let release: () => void = (): void => undefined;
    const claim = vi.fn().mockImplementation(
      (): Promise<DueReminder[]> =>
        new Promise<DueReminder[]>(resolve => {
          release = (): void => {
            resolve([due()]);
          };
        })
    );
    const scheduler = new ReminderScheduler({
      deliver: deliverTo("device"),
      claim,
      logger: silentLogger(),
    });

    const first = scheduler.tick(DUE_AT);
    const second = scheduler.tick(DUE_AT);
    release();

    expect(await first).toBe(await second);
    expect(claim).toHaveBeenCalledTimes(1);
  });

  it("warns when a batch fills up so nothing waits silently", async () => {
    const logger = silentLogger();
    const items = Array.from(
      { length: 50 },
      (_unused, index): DueReminder => due({ id: `r${index}` })
    );
    const scheduler = new ReminderScheduler({
      deliver: deliverTo(),
      claim: async (): Promise<DueReminder[]> => items,
      logger,
    });

    await scheduler.tick(DUE_AT);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ batch: 50 }),
      expect.stringContaining("batch")
    );
  });

  it("ticks on the configured interval and stops when told", async () => {
    vi.useFakeTimers();
    const claim = vi.fn().mockResolvedValue([] as DueReminder[]);
    const scheduler = new ReminderScheduler({
      deliver: deliverTo(),
      claim,
      intervalMs: 1_000,
      logger: silentLogger(),
    });

    scheduler.start();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(claim).toHaveBeenCalledTimes(3);

    scheduler.stop();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(claim).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });

  it("logs a fire with its latency and channels", async () => {
    const logger = silentLogger();
    const scheduler = new ReminderScheduler({
      deliver: deliverTo("device"),
      claim: async (): Promise<DueReminder[]> => [due({ rrule: "FREQ=DAILY" })],
      logger,
    });

    await scheduler.tick(new Date(DUE_AT.getTime() + 7_000));

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        reminderId: "reminder-1",
        channels: ["device"],
        latencyMs: 7_000,
        recurring: true,
      }),
      "reminder fired"
    );
  });
});

describe("createReminderNotifier", () => {
  it("reports the device channel when a socket took the reminder", async () => {
    const notifyUser = vi.fn().mockReturnValue(2);
    const push = vi.fn().mockResolvedValue({ sent: 0, failed: 0 });
    const deliver = createReminderNotifier({ notifyUser, push, logger: silentLogger(), record: vi.fn().mockResolvedValue(undefined) });

    await expect(deliver(due({ channels: ["device", "push"] }))).resolves.toEqual(["device"]);
    expect(notifyUser).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        type: "reminder.fire",
        reminderId: "reminder-1",
        text: "Stretch break",
        dueAt: DUE_AT.toISOString(),
      })
    );
  });

  it("queues the fire when the user has no device connected", async () => {
    const queue = vi.fn().mockResolvedValue(undefined);
    const record = vi.fn().mockResolvedValue(undefined);
    const deliver = createReminderNotifier({
      notifyUser: (): number => 0,
      logger: silentLogger(),
      record,
      queue,
    });

    await expect(deliver(due({ channels: ["device"] }))).resolves.toEqual([]);
    expect(queue).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ type: "reminder.fire", reminderId: "reminder-1" })
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "device", status: "PENDING" })
    );
  });

  it("reports push only when Expo accepted a ticket", async () => {
    const notifyUser = vi.fn();
    const push = vi.fn().mockResolvedValue({ sent: 1, failed: 0 });
    const deliver = createReminderNotifier({ notifyUser, push, logger: silentLogger(), record: vi.fn().mockResolvedValue(undefined) });

    await expect(deliver(due({ channels: ["phone", "push"] }))).resolves.toEqual(["push"]);
    expect(notifyUser).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", reminderId: "reminder-1" })
    );
  });

  it("does not claim a push delivery when no token accepted it", async () => {
    const push = vi.fn().mockResolvedValue({ sent: 0, failed: 0 });
    const deliver = createReminderNotifier({
      notifyUser: vi.fn(),
      push,
      logger: silentLogger(),
      record: vi.fn().mockResolvedValue(undefined),
    });

    await expect(deliver(due({ channels: ["phone", "push"] }))).resolves.toEqual([]);
  });

  it("includes the rule only for recurring reminders", async () => {
    const notifyUser = vi.fn().mockReturnValue(1);
    const deliver = createReminderNotifier({ notifyUser, logger: silentLogger(), record: vi.fn().mockResolvedValue(undefined) });

    await deliver(due({ rrule: "FREQ=WEEKLY;BYDAY=MO" }));

    expect(notifyUser.mock.calls[0]?.[1]).toMatchObject({ rrule: "FREQ=WEEKLY;BYDAY=MO" });
  });
});
