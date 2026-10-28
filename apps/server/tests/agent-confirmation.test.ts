import { AIMessage, HumanMessage } from "@langchain/core/messages";
import {
  Command,
  END,
  MemorySaver,
  MessagesAnnotation,
  START,
  StateGraph,
  isInterrupted,
} from "@langchain/langgraph";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TODO_ID = "11111111-1111-4111-8111-111111111111";

const { getTodos, deleteTodo } = vi.hoisted(() => ({
  getTodos: vi.fn(async () => [
    { id: "11111111-1111-4111-8111-111111111111", title: "Finish the lab" },
  ]),
  deleteTodo: vi.fn(async () => ({
    id: "11111111-1111-4111-8111-111111111111",
    title: "Finish the lab",
  })),
}));

vi.mock("@robo/shared/todos", () => ({
  getTodos,
  deleteTodo,
  createTodo: vi.fn(),
  completeTodo: vi.fn(),
  updateTodo: vi.fn(),
}));

vi.mock("@robo/shared/action-logs", () => ({
  logAction: vi.fn(async () => undefined),
}));

const { buildTools } = await import("../src/modules/ai/tools");
const { classifyConfirmationReply } = await import("../src/modules/ai/agent");

function deleteGraph() {
  const deleteTool = buildTools({
    userId: "user-1",
    conversationId: "conversation-1",
    timezone: "UTC",
    locale: "en",
    now: new Date("2026-10-26T10:00:00Z"),
  }).find(tool => tool.name === "delete_todo");

  if (!deleteTool) {
    throw new Error("delete_todo tool is missing");
  }

  return new StateGraph(MessagesAnnotation)
    .addNode("delete", async () => ({
      messages: [
        new AIMessage(
          await deleteTool.invoke({ todoId: TODO_ID } as never)
        ),
      ],
    }))
    .addEdge(START, "delete")
    .addEdge("delete", END)
    .compile({ checkpointer: new MemorySaver() });
}

describe("confirmation replies", () => {
  it("classifies clear yes and no answers", () => {
    expect(classifyConfirmationReply("yes")).toBe("approve");
    expect(classifyConfirmationReply("Yes, delete it.")).toBe("approve");
    expect(classifyConfirmationReply("okay")).toBe("approve");
    expect(classifyConfirmationReply("no")).toBe("reject");
    expect(classifyConfirmationReply("No, keep it")).toBe("reject");
    expect(classifyConfirmationReply("not now")).toBe("reject");
  });

  it("keeps unrelated replies ambiguous", () => {
    expect(classifyConfirmationReply("what time is my class?")).toBe("ambiguous");
    expect(classifyConfirmationReply("cancel")).toBe("ambiguous");
    expect(classifyConfirmationReply("")).toBe("ambiguous");
  });
});

describe("destructive tool confirmation", () => {
  beforeEach(() => {
    getTodos.mockClear();
    deleteTodo.mockClear();
  });

  it("pauses before deleting and resumes with approval", async () => {
    const graph = deleteGraph();
    const config = { configurable: { thread_id: "delete-approved" } };

    const first = await graph.invoke(
      { messages: [new HumanMessage("delete my lab task")] },
      config
    );

    expect(isInterrupted<{ prompt: string }>(first)).toBe(true);
    if (!isInterrupted<{ prompt: string }>(first)) {
      throw new Error("expected an interrupt");
    }
    expect(first.__interrupt__[0]?.value).toMatchObject({
      type: "confirmation",
      action: "delete_todo",
      targetId: TODO_ID,
      prompt: "Delete \"Finish the lab\"?",
    });
    expect(deleteTodo).not.toHaveBeenCalled();

    const resumed = await graph.invoke(new Command({ resume: "approve" }), config);
    expect(deleteTodo).toHaveBeenCalledWith("user-1", TODO_ID);

    const last = resumed.messages.at(-1);
    expect(last?.content).toContain(`"deletedTodoId":"${TODO_ID}"`);
  });

  it("does not delete when the student declines", async () => {
    const graph = deleteGraph();
    const config = { configurable: { thread_id: "delete-rejected" } };

    const first = await graph.invoke(
      { messages: [new HumanMessage("delete my lab task")] },
      config
    );
    expect(isInterrupted(first)).toBe(true);
    const resumed = await graph.invoke(new Command({ resume: "reject" }), config);

    expect(deleteTodo).not.toHaveBeenCalled();
    const last = resumed.messages.at(-1);
    expect(last?.content).toContain("\"cancelled\":true");
  });
});
