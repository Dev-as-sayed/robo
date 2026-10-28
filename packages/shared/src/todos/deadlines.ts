import { prisma } from "../lib/prisma";

export type DeadlineWindow = "24h" | "2h";
const HOUR_MS = 60 * 60 * 1000;

export interface DueTodoDeadline {
  id: string;
  userId: string;
  title: string;
  dueAt: Date;
  window: DeadlineWindow;
  firedAt: Date;
}

/** Claims the 24-hour and 2-hour warnings without sending both for a late-created task. */
export async function claimDueTodoDeadlines(
  now: Date,
  limit = 50
): Promise<DueTodoDeadline[]> {
  const in24h = new Date(now.getTime() + 24 * HOUR_MS);
  const in2h = new Date(now.getTime() + 2 * HOUR_MS);
  const claimed: DueTodoDeadline[] = [];

  const daily = await prisma.todo.findMany({
    where: {
      status: "pending",
      warned24hAt: null,
      dueAt: { gt: in2h, lte: in24h },
    },
    orderBy: { dueAt: "asc" },
    take: limit,
    select: { id: true, userId: true, title: true, dueAt: true },
  });

  for (const todo of daily) {
    if (!todo.dueAt) continue;
    const updated = await prisma.todo.updateMany({
      where: { id: todo.id, warned24hAt: null },
      data: { warned24hAt: now },
    });
    if (updated.count !== 1) continue;

    claimed.push({
      id: todo.id,
      userId: todo.userId,
      title: todo.title,
      dueAt: todo.dueAt,
      window: "24h",
      firedAt: now,
    });
  }

  const remaining = Math.max(0, limit - claimed.length);
  if (remaining === 0) {
    return claimed;
  }

  const soon = await prisma.todo.findMany({
    where: {
      status: "pending",
      warned2hAt: null,
      dueAt: { gt: now, lte: in2h },
    },
    orderBy: { dueAt: "asc" },
    take: remaining,
    select: { id: true, userId: true, title: true, dueAt: true },
  });

  for (const todo of soon) {
    if (!todo.dueAt) continue;
    const updated = await prisma.todo.updateMany({
      where: { id: todo.id, warned2hAt: null },
      data: { warned2hAt: now },
    });
    if (updated.count !== 1) continue;

    claimed.push({
      id: todo.id,
      userId: todo.userId,
      title: todo.title,
      dueAt: todo.dueAt,
      window: "2h",
      firedAt: now,
    });
  }

  return claimed;
}
