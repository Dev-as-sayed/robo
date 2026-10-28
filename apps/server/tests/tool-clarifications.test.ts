import { describe, expect, it, vi } from "vitest";

vi.mock("@robo/shared/todos", () => ({
  getTodos: vi.fn(async () => []),
  createTodo: vi.fn(),
  completeTodo: vi.fn(),
  deleteTodo: vi.fn(),
  updateTodo: vi.fn(),
}));

const { buildTools } = await import("../src/modules/ai/tools");

const tools = buildTools({
  userId: "user-1",
  conversationId: "conversation-1",
  timezone: "UTC",
  locale: "en",
  now: new Date("2026-10-24T10:00:00Z"),
});

function find(name: string) {
  const tool = tools.find(candidate => candidate.name === name);
  if (!tool) throw new Error(`missing tool ${name}`);
  return tool;
}

async function invoke(name: string, input: unknown) {
  return JSON.parse(await find(name).invoke(input as never));
}

describe("deterministic tool clarifications", () => {
  it("asks for a task title instead of leaking a schema error", async () => {
    const payload = await invoke("create_todo", {});

    expect(payload).toMatchObject({
      ok: false,
      error: {
        code: "MISSING_ARGUMENTS",
        missing: ["title"],
        question: "What should I call it?",
      },
    });
  });

  it("asks for the reminder text in one response", async () => {
    const payload = await invoke("create_reminder", {});

    expect(payload.error.code).toBe("MISSING_ARGUMENTS");
    expect(payload.error.missing).toEqual(["text"]);
    expect(payload.error.question).toBe("What should I remind you about?");
  });

  it("passes validation through for a complete call", async () => {
    const payload = await invoke("list_todos", { status: "pending" });

    expect(payload.ok).toBe(true);
    expect(payload.data).toHaveProperty("todos");
  });

  it("adds a clarification question to known tool failures", async () => {
    const payload = await invoke("remind_to_call", {});

    expect(payload.ok).toBe(false);
    expect(payload.error).toMatchObject({
      code: "MISSING_ARGUMENTS",
      question: "Could you share the missing details?",
    });
  });
});
