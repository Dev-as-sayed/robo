import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  memory: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@robo/shared/lib/prisma", () => ({ prisma: db }));

const { createMemory, deleteMemory, listMemories, updateMemory } = await import(
  "@robo/shared/memories"
);

const now = new Date("2026-10-23T12:00:00.000Z");

function memory(overrides: Record<string, unknown> = {}) {
  return {
    id: "memory-1",
    userId: "user-1",
    content: "Prefers examples",
    category: "preference",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("memories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("trims and creates a memory", async () => {
    db.memory.create.mockResolvedValue(memory());

    await createMemory("user-1", {
      content: "  Prefers examples  ",
      category: "preference",
    });

    expect(db.memory.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        content: "Prefers examples",
        category: "preference",
      },
      select: expect.any(Object),
    });
  });

  it("rejects empty and oversized memories", async () => {
    await expect(createMemory("user-1", { content: "   " })).rejects.toThrow(
      "MEMORY_CONTENT_REQUIRED"
    );
    await expect(
      createMemory("user-1", { content: "x".repeat(1001) })
    ).rejects.toThrow("MEMORY_TOO_LONG");
  });

  it("lists only the current user's memories with a clamped limit", async () => {
    db.memory.findMany.mockResolvedValue([memory()]);

    await listMemories("user-1", { category: "preference", limit: 500 });

    expect(db.memory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", category: "preference" },
        take: 100,
      })
    );
  });

  it("requires ownership before updating", async () => {
    db.memory.findFirst.mockResolvedValue(null);

    await expect(
      updateMemory("user-1", "memory-2", { content: "New" })
    ).rejects.toThrow("MEMORY_NOT_FOUND");
    expect(db.memory.update).not.toHaveBeenCalled();
  });

  it("deletes with the composite ownership key", async () => {
    db.memory.delete.mockResolvedValue(memory());

    await deleteMemory("user-1", "memory-1");

    expect(db.memory.delete).toHaveBeenCalledWith({
      where: { id: "memory-1", userId: "user-1" },
    });
  });
});
