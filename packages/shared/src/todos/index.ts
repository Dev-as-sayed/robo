import { prisma } from "../lib/prisma";
export * from "./deadlines";

export interface Todo {
  id: string;
  userId: string;
  title: string;
  notes: string | null;
  dueAt: Date | null;
  subject: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: "pending" | "completed" | "snoozed";
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function createTodo(userId: string, data: {
  title: string;
  due?: Date;
  subject?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  notes?: string;
}) {
  return await prisma.todo.create({
    data: {
      userId,
      title: data.title,
      notes: data.notes,
      dueAt: data.due,
      subject: data.subject,
      priority: data.priority ?? "medium",
      status: "pending",
    },
    select: {
      id: true,
      userId: true,
      title: true,
      notes: true,
      dueAt: true,
      subject: true,
      priority: true,
      status: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getTodos(userId: string, filters: {
  status?: string;
  subject?: string;
  dueBefore?: string;
}) {
  const where: any = { userId };

  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.subject) {
    where.subject = filters.subject;
  }
  if (filters.dueBefore) {
    where.dueAt = { lte: new Date(filters.dueBefore) };
  }

  return await prisma.todo.findMany({
    where,
    orderBy: { dueAt: "asc" },
    select: {
      id: true,
      userId: true,
      title: true,
      notes: true,
      dueAt: true,
      subject: true,
      priority: true,
      status: true,
      completedAt: true,
      createdAt: true,
    },
  });
}

export async function updateTodo(userId: string, todoId: string, data: any) {
  const patch = { ...data };
  if (data.status === "completed") {
    patch.completedAt = new Date();
  } else if (data.status) {
    patch.completedAt = null;
  }
  if (data.dueAt !== undefined) {
    patch.warned24hAt = null;
    patch.warned2hAt = null;
  }

  return await prisma.todo.update({
    where: { id: todoId, userId },
    data: patch,
    select: {
      id: true,
      userId: true,
      title: true,
      notes: true,
      dueAt: true,
      subject: true,
      priority: true,
      status: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function deleteTodo(userId: string, todoId: string) {
  return await prisma.todo.delete({
    where: { id: todoId, userId },
  });
}

export async function completeTodo(userId: string, todoId: string) {
  return await prisma.todo.update({
    where: { id: todoId, userId },
    data: { status: "completed", completedAt: new Date() },
    select: {
      id: true,
      userId: true,
      title: true,
      notes: true,
      dueAt: true,
      subject: true,
      priority: true,
      status: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}