import { prisma } from "../lib/prisma";

export const MEMORY_CATEGORIES = ["general", "preference", "fact", "goal", "study"] as const;
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export interface Memory {
  id: string;
  userId: string;
  content: string;
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

const select = {
  id: true,
  userId: true,
  content: true,
  category: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function createMemory(
  userId: string,
  data: { content: string; category?: MemoryCategory }
): Promise<Memory> {
  const content = data.content.trim();
  if (!content) {
    throw new Error("MEMORY_CONTENT_REQUIRED");
  }
  if (content.length > 1000) {
    throw new Error("MEMORY_TOO_LONG");
  }

  return prisma.memory.create({
    data: {
      userId,
      content,
      category: data.category ?? "general",
    },
    select,
  });
}

export async function listMemories(
  userId: string,
  filters: { category?: MemoryCategory; limit?: number } = {}
): Promise<Memory[]> {
  return prisma.memory.findMany({
    where: {
      userId,
      ...(filters.category ? { category: filters.category } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: Math.min(100, Math.max(1, filters.limit ?? 50)),
    select,
  });
}

export async function updateMemory(
  userId: string,
  memoryId: string,
  data: { content?: string; category?: MemoryCategory }
): Promise<Memory> {
  const current = await prisma.memory.findFirst({
    where: { id: memoryId, userId },
    select: { id: true },
  });
  if (!current) {
    throw new Error("MEMORY_NOT_FOUND");
  }

  const patch: { content?: string; category?: MemoryCategory } = {};
  if (data.content !== undefined) {
    const content = data.content.trim();
    if (!content) throw new Error("MEMORY_CONTENT_REQUIRED");
    if (content.length > 1000) throw new Error("MEMORY_TOO_LONG");
    patch.content = content;
  }
  if (data.category !== undefined) {
    patch.category = data.category;
  }

  return prisma.memory.update({
    where: { id: memoryId, userId },
    data: patch,
    select,
  });
}

export async function deleteMemory(userId: string, memoryId: string): Promise<void> {
  await prisma.memory.delete({ where: { id: memoryId, userId } });
}
