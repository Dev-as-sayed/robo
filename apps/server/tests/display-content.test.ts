import { describe, expect, it } from "vitest";
import { buildDisplayContent } from "@robo/shared/chat";

describe("buildDisplayContent", () => {
  it("renders task tool output as a card", () => {
    const content = buildDisplayContent("You have two tasks.", [
      {
        toolName: "list_todos",
        output: {
          todos: [
            {
              id: "todo-1",
              title: "Finish calculus",
              dueAt: "2026-10-24T10:00:00.000Z",
              subject: "Math",
              priority: "high",
              status: "pending",
            },
            { id: "todo-2", title: "Read chapter 4", status: "pending" },
          ],
        },
      },
    ]);

    expect(content).toEqual({
      version: 1,
      title: null,
      blocks: [
        {
          type: "card",
          section: "tasks",
          title: "Tasks",
          items: [
            {
              id: "todo-1",
              title: "Finish calculus",
              subtitle: "2026-10-24T10:00:00.000Z",
              meta: "Math · high",
              status: "pending",
            },
            {
              id: "todo-2",
              title: "Read chapter 4",
              meta: undefined,
              status: "pending",
            },
          ],
        },
      ],
    });
  });

  it("keeps analytics as a labelled metric card", () => {
    const content = buildDisplayContent("You studied well.", [
      {
        toolName: "get_analytics_summary",
        output: { range: "week", sessions: 4, studyMinutes: 120, completedTodos: 3 },
      },
    ]);

    expect(content.blocks[0]).toMatchObject({
      type: "card",
      section: "analytics",
      title: "Study summary (week)",
      items: [
        { title: "Study sessions", meta: "4" },
        { title: "Study minutes", meta: "120" },
        { title: "Tasks completed", meta: "3" },
      ],
    });
  });

  it("falls back to the plain reply when no action is renderable", () => {
    expect(buildDisplayContent("Here is an explanation.")).toEqual({
      version: 1,
      title: null,
      blocks: [{ type: "text", text: "Here is an explanation." }],
    });
  });
});

describe("rich chat cards", () => {
  it("renders a tappable quiz card", () => {
    const content = buildDisplayContent("Here is a quiz.", [
      {
        toolName: "generate_quiz",
        output: {
          quizId: "quiz-1",
          title: "Fractions",
          subject: "Math",
          topic: "Fractions",
          questionCount: 10,
        },
      },
    ]);

    expect(content.blocks[0]).toMatchObject({
      type: "card",
      section: "quizzes",
      action: { label: "Open quizzes", route: "/quizzes" },
      items: [{ id: "quiz-1", title: "Fractions", meta: "Math · 10 questions" }],
    });
  });

  it("renders a tappable study-plan card", () => {
    const content = buildDisplayContent("Plan ready.", [
      {
        toolName: "create_study_plan",
        output: { planId: "plan-1", examId: "exam-1", totalDays: 5 },
      },
    ]);

    expect(content.blocks[0]).toMatchObject({
      type: "card",
      section: "plans",
      action: { label: "Open plan", route: "/exams?examId=exam-1" },
      items: [{ title: "Study plan · 5 days", subtitle: "Exam exam-1" }],
    });
  });

  it("routes a confirmation card to its pending action", () => {
    const content = buildDisplayContent("Ready to call.", [
      {
        toolName: "prepare_call",
        output: {
          pendingAction: {
            id: "action-1",
            kind: "CALL",
            recipientName: "Asha",
            recipientPhone: "+919876543210",
            status: "PENDING",
          },
        },
      },
    ]);

    expect(content.blocks[0]).toMatchObject({
      type: "card",
      section: "actions",
      action: {
        label: "Review",
        route: "/approvals?actionId=action-1",
      },
      items: [{ id: "action-1", title: "Call Asha" }],
    });
  });

  it("renders citation cards with page metadata", () => {
    const content = buildDisplayContent("See the textbook.", [
      {
        toolName: "search_documents",
        output: {
          chunks: [
            {
              documentId: "doc-1",
              source: "chapter-3.pdf",
              page: 42,
              score: 0.91,
              text: "Photosynthesis converts light into chemical energy.",
            },
          ],
        },
      },
    ]);

    expect(content.blocks[0]).toMatchObject({
      type: "card",
      section: "citations",
      action: { label: "Open documents", route: "/documents" },
      items: [
        {
          id: "doc-1",
          title: "chapter-3.pdf",
          subtitle: "Photosynthesis converts light into chemical energy.",
          meta: "page 42 · score 0.91",
          page: 42,
        },
      ],
    });
  });
});
