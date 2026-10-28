import { beforeEach, describe, expect, it, vi } from "vitest";

const countDocuments = vi.hoisted(() => vi.fn());

vi.mock("@robo/shared/documents", () => ({ countDocuments }));

const { chatTaskForUser } = await import("../src/modules/ai/chat-service");

describe("document AI routing", () => {
  beforeEach(() => {
    countDocuments.mockReset();
  });

  it("keeps cloud routing when the student allows cloud AI for documents", async () => {
    await expect(chatTaskForUser("user-1", true)).resolves.toBe("agent_tools");
    expect(countDocuments).not.toHaveBeenCalled();
  });

  it("uses the local chain when documents exist and cloud docs are off", async () => {
    countDocuments.mockResolvedValue(3);
    await expect(chatTaskForUser("user-1", false)).resolves.toBe("private_docs");
  });

  it("keeps cloud routing when there are no documents", async () => {
    countDocuments.mockResolvedValue(0);
    await expect(chatTaskForUser("user-1", false)).resolves.toBe("agent_tools");
  });

  it("fails closed if the document count cannot be read", async () => {
    countDocuments.mockRejectedValue(new Error("db down"));
    await expect(chatTaskForUser("user-1", false)).resolves.toBe("private_docs");
  });
});
