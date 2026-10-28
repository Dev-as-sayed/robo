import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.hoisted(() => vi.fn());
vi.mock("../src/modules/reminders/expo-push", () => ({
  sendPushToUser: push,
}));

const { publishAppActionEvent, setAppEventNotifier } = await import(
  "../src/modules/actions/events"
);

const action = {
  id: "action-1",
  userId: "user-1",
  contactId: null,
  kind: "CALL" as const,
  recipientName: "Sam",
  recipientPhone: "+15550100",
  recipientEmail: null,
  body: null,
  status: "PENDING" as const,
  expiresAt: new Date("2026-10-24T12:05:00.000Z"),
  confirmedAt: null,
  rejectedAt: null,
  createdAt: new Date("2026-10-24T12:00:00.000Z"),
  updatedAt: new Date("2026-10-24T12:00:00.000Z"),
};

afterEach(() => {
  setAppEventNotifier(null);
  vi.clearAllMocks();
});

describe("app action events", () => {
  it("sends the confirm request over the app socket and Expo push", async () => {
    const notify = vi.fn(() => 1);
    push.mockResolvedValue({ sent: 1, failed: 0 });
    setAppEventNotifier(notify);

    publishAppActionEvent("user-1", "action.confirm.request", action);

    expect(notify).toHaveBeenCalledWith("user-1", {
      type: "action.confirm.request",
      action: {
        id: "action-1",
        kind: "CALL",
        recipientName: "Sam",
        status: "PENDING",
        expiresAt: "2026-10-24T12:05:00.000Z",
      },
    });
    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        title: "Confirm with Robo",
        data: {
          kind: "pending_action",
          event: "action.confirm.request",
          actionId: "action-1",
        },
      })
    );
  });

  it("includes the deep link for an executed action", async () => {
    push.mockResolvedValue({ sent: 1, failed: 0 });
    const event = publishAppActionEvent("user-1", "action.execute", {
      ...action,
      status: "CONFIRMED",
      uri: "tel:+15550100",
    });

    expect(event.action.uri).toBe("tel:+15550100");
    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ event: "action.execute" }),
      })
    );
  });

  it("survives a throwing socket notifier", () => {
    setAppEventNotifier(() => {
      throw new Error("socket down");
    });
    push.mockResolvedValue({ sent: 0, failed: 0 });

    expect(() =>
      publishAppActionEvent("user-1", "action.confirm.request", action)
    ).not.toThrow();
  });
});
