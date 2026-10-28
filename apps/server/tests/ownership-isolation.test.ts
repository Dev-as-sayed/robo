import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  expectOwnershipIsolation,
  filterOwned,
  findOwned,
} from "./helpers/user-isolation";

const rows = vi.hoisted(() => ({
  quiz: [
    { id: "quiz-a", userId: "user-a", title: "Physics" },
    { id: "quiz-b", userId: "user-b", title: "Chemistry" },
  ],
  classNote: [
    { id: "note-a", userId: "user-a", title: "Optics" },
    { id: "note-b", userId: "user-b", title: "Bonds" },
  ],
  memory: [
    { id: "memory-a", userId: "user-a", content: "Prefers examples" },
    { id: "memory-b", userId: "user-b", content: "Likes flashcards" },
  ],
}));

const db = vi.hoisted(() => ({
  quiz: { findFirst: vi.fn(), findMany: vi.fn() },
  classNote: { findFirst: vi.fn(), findMany: vi.fn() },
  memory: { findFirst: vi.fn(), findMany: vi.fn() },
  quizAttempt: { findMany: vi.fn() },
}));

vi.mock("@robo/shared/lib/prisma", () => ({ prisma: db }));

const { getQuiz, getQuizzes } = await import("@robo/shared/quizzes");
const { getClassNote, getClassNotes } = await import("@robo/shared/class-notes");
const { listMemories } = await import("@robo/shared/memories");

describe("ownership isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.quiz.findFirst.mockImplementation(async ({ where }: any) =>
      findOwned(rows.quiz, where)
    );
    db.quiz.findMany.mockImplementation(async ({ where }: any) =>
      filterOwned(rows.quiz, where.userId)
    );
    db.classNote.findFirst.mockImplementation(async ({ where }: any) =>
      findOwned(rows.classNote, where)
    );
    db.classNote.findMany.mockImplementation(async ({ where }: any) =>
      filterOwned(rows.classNote, where.userId)
    );
    db.memory.findMany.mockImplementation(async ({ where }: any) =>
      filterOwned(rows.memory, where.userId)
    );
  });

  it("never returns another user's quiz", async () => {
    await expectOwnershipIsolation({
      ownerId: "user-a",
      otherId: "user-b",
      id: "quiz-a",
      read: getQuiz,
    });
    await expect(getQuizzes("user-b")).resolves.toEqual([
      expect.objectContaining({ userId: "user-b" }),
    ]);
  });

  it("never returns another user's class note", async () => {
    await expectOwnershipIsolation({
      ownerId: "user-a",
      otherId: "user-b",
      id: "note-a",
      read: getClassNote,
      missingError: "CLASS_NOTE_NOT_FOUND",
    });
    await expect(getClassNotes("user-b")).resolves.toEqual([
      expect.objectContaining({ userId: "user-b" }),
    ]);
  });

  it("never returns another user's memories", async () => {
    const result = await listMemories("user-b");
    expect(result).toEqual([expect.objectContaining({ userId: "user-b" })]);
    expect(result.some(memory => memory.userId === "user-a")).toBe(false);
  });
});
