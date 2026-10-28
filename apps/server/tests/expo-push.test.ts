import { beforeEach, describe, expect, it, vi } from "vitest";

const listPushTokenStrings = vi.fn();
const revokePushTokenById = vi.fn();

vi.mock("@robo/shared/users", () => ({
  listPushTokenStrings,
  revokePushTokenById,
}));

const { sendReminderPush } = await import("../src/modules/reminders/expo-push");

const reminder = {
  userId: "user-1",
  reminderId: "reminder-1",
  text: "Study calculus",
  dueAt: new Date("2026-10-23T18:00:00.000Z"),
};

describe("sendReminderPush", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    revokePushTokenById.mockResolvedValue(undefined);
  });

  it("sends a batch and counts accepted tickets", async () => {
    listPushTokenStrings.mockResolvedValue(["ExponentPushToken[a]", "ExponentPushToken[b]"]);
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ status: "ok" }, { status: "ok" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(sendReminderPush(reminder, fetchImpl)).resolves.toEqual({
      sent: 2,
      failed: 0,
    });

    const body = JSON.parse(fetchImpl.mock.calls[0][1].body as string);
    expect(body[0]).toMatchObject({
      to: "ExponentPushToken[a]",
      title: "Reminder",
      body: "Study calculus",
      data: { reminderId: "reminder-1" },
    });
  });

  it("removes tokens Expo reports as uninstalled", async () => {
    listPushTokenStrings.mockResolvedValue(["ExponentPushToken[dead]"]);
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ status: "error", details: { error: "DeviceNotRegistered" } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    await expect(sendReminderPush(reminder, fetchImpl)).resolves.toEqual({
      sent: 0,
      failed: 1,
    });
    expect(revokePushTokenById).toHaveBeenCalledWith("user-1", "ExponentPushToken[dead]");
  });

  it("does not call Expo when no token is registered", async () => {
    listPushTokenStrings.mockResolvedValue([]);
    const fetchImpl = vi.fn();

    await expect(sendReminderPush(reminder, fetchImpl)).resolves.toEqual({
      sent: 0,
      failed: 0,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
