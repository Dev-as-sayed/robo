import { describe, expect, it, vi } from "vitest";
import type { DueTodoDeadline } from "@robo/shared/todos";
import { createTodoDeadlineNotifier } from "../src/modules/todos/deadline-notifier";

const dueAt = new Date("2026-10-24T18:00:00.000Z");
const now = new Date("2026-10-23T18:00:00.000Z");

function deadline(overrides: Partial<DueTodoDeadline> = {}): DueTodoDeadline {
  return {
    id: "todo-1",
    userId: "user-1",
    title: "Submit lab report",
    dueAt,
    window: "24h",
    firedAt: now,
    ...overrides,
  };
}

describe("createTodoDeadlineNotifier", () => {
  it("sends a 24-hour warning to the device and phone", async () => {
    const notifyUser = vi.fn().mockReturnValue(1);
    const push = vi.fn().mockResolvedValue({ sent: 1, failed: 0 });
    const deliver = createTodoDeadlineNotifier({ notifyUser, push });

    await expect(deliver(deadline())).resolves.toBe(true);
    expect(notifyUser).toHaveBeenCalledWith("user-1", {
      type: "display",
      kind: "text",
      title: "Task due soon",
      body: "Submit lab report is due in about 24 hours.",
      dueAt: dueAt.toISOString(),
    });
    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({
        reminderId: "todo-deadline:todo-1:24h",
        text: "Task due in 24 hours: Submit lab report",
      })
    );
  });

  it("uses the 2-hour wording and queues when the speaker is offline", async () => {
    const queue = vi.fn().mockResolvedValue(undefined);
    const deliver = createTodoDeadlineNotifier({
      notifyUser: vi.fn().mockReturnValue(0),
      queue,
      push: vi.fn().mockResolvedValue({ sent: 0, failed: 0 }),
    });

    await expect(deliver(deadline({ window: "2h" }))).resolves.toBe(true);
    expect(queue).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ body: "Submit lab report is due in about 2 hours." })
    );
  });

  it("still succeeds on push when the device queue fails", async () => {
    const deliver = createTodoDeadlineNotifier({
      notifyUser: vi.fn().mockReturnValue(0),
      queue: vi.fn().mockRejectedValue(new Error("queue down")),
      push: vi.fn().mockResolvedValue({ sent: 1, failed: 0 }),
    });

    await expect(deliver(deadline())).resolves.toBe(true);
  });
});
