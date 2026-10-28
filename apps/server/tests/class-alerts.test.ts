import { describe, expect, it, vi } from "vitest";
import { computeAlertAt, isCancelledOnDay, type DueClass } from "@robo/shared/schedule";
import { createClassAlertNotifier } from "../src/modules/schedule/class-alert-notifier";

const startsAt = new Date("2026-10-23T10:00:00.000Z");
const firedAt = new Date("2026-10-23T09:50:00.000Z");

function dueClass(overrides: Partial<DueClass> = {}): DueClass {
  return {
    id: "class-1",
    userId: "user-1",
    timezone: "UTC",
    title: "Algorithms",
    subject: "CS",
    room: "B12",
    startsAt,
    dueAt: firedAt,
    firedAt,
    ...overrides,
  };
}

describe("class alert timing", () => {
  it("defaults to ten minutes before class", () => {
    expect(computeAlertAt({ startAt: startsAt, allDay: false }, firedAt)).toEqual(
      new Date("2026-10-23T09:50:00.000Z")
    );
  });

  it("skips all-day and already-started entries", () => {
    expect(computeAlertAt({ startAt: startsAt, allDay: true }, firedAt)).toBeNull();
    expect(computeAlertAt({ startAt: startsAt, allDay: false }, startsAt)).toBeNull();
  });

  it("suppresses an alert on an exception day", () => {
    expect(
      isCancelledOnDay(startsAt, [new Date("2026-10-23T12:00:00.000Z")])
    ).toBe(true);
    expect(
      isCancelledOnDay(startsAt, [new Date("2026-10-24T12:00:00.000Z")])
    ).toBe(false);
  });
});

describe("createClassAlertNotifier", () => {
  it("sends the device message and push", async () => {
    const notifyUser = vi.fn().mockReturnValue(1);
    const push = vi.fn().mockResolvedValue({ sent: 1, failed: 0 });
    const deliver = createClassAlertNotifier({ notifyUser, push });

    await expect(deliver(dueClass())).resolves.toBe(true);
    expect(notifyUser).toHaveBeenCalledWith("user-1", {
      type: "class.alert",
      scheduleId: "class-1",
      title: "Algorithms",
      startsAt: startsAt.toISOString(),
      minutesUntil: 10,
      room: "B12",
      subject: "CS",
    });
    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ reminderId: "class:class-1", text: "Algorithms starts in 10 min" })
    );
  });

  it("queues the alert when the speaker is offline", async () => {
    const queue = vi.fn().mockResolvedValue(undefined);
    const deliver = createClassAlertNotifier({
      notifyUser: vi.fn().mockReturnValue(0),
      queue,
      push: vi.fn().mockResolvedValue({ sent: 0, failed: 0 }),
    });

    await expect(deliver(dueClass())).resolves.toBe(true);
    expect(queue).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ type: "class.alert", scheduleId: "class-1" })
    );
  });
});
