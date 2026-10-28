import { prisma } from "../lib/prisma";

const topicSelect = {
  id: true,
  userId: true,
  subjectId: true,
  name: true,
  masteryScore: true,
  createdAt: true,
  updatedAt: true,
} as const;

const subjectSelect = {
  id: true,
  userId: true,
  name: true,
  color: true,
  topics: {
    select: topicSelect,
    orderBy: { name: "asc" as const },
  },
  createdAt: true,
  updatedAt: true,
} as const;

async function requireSubject(userId: string, subjectId: string): Promise<void> {
  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, userId },
    select: { id: true },
  });

  if (!subject) {
    throw new Error("SUBJECT_NOT_FOUND");
  }
}

export async function getSubjects(userId: string) {
  return prisma.subject.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    select: subjectSelect,
  });
}

export async function getSubject(userId: string, subjectId: string) {
  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, userId },
    select: subjectSelect,
  });

  if (!subject) {
    throw new Error("SUBJECT_NOT_FOUND");
  }

  return subject;
}

export async function createSubject(
  userId: string,
  data: { name: string; color?: string }
) {
  return prisma.subject.create({
    data: {
      userId,
      name: data.name,
      color: data.color,
    },
    select: subjectSelect,
  });
}

export async function updateSubject(
  userId: string,
  subjectId: string,
  data: { name?: string; color?: string }
) {
  await requireSubject(userId, subjectId);

  return prisma.subject.update({
    where: { id: subjectId, userId },
    data,
    select: subjectSelect,
  });
}

export async function deleteSubject(userId: string, subjectId: string) {
  await requireSubject(userId, subjectId);

  return prisma.subject.delete({
    where: { id: subjectId, userId },
  });
}

export async function createTopic(
  userId: string,
  subjectId: string,
  data: { name: string; masteryScore?: number }
) {
  await requireSubject(userId, subjectId);

  return prisma.topic.create({
    data: {
      userId,
      subjectId,
      name: data.name,
      masteryScore: data.masteryScore ?? 0,
    },
    select: topicSelect,
  });
}

export async function updateTopic(
  userId: string,
  subjectId: string,
  topicId: string,
  data: { name?: string; masteryScore?: number }
) {
  const topic = await prisma.topic.findFirst({
    where: { id: topicId, subjectId, userId },
    select: { id: true },
  });

  if (!topic) {
    throw new Error("TOPIC_NOT_FOUND");
  }

  return prisma.topic.update({
    where: { id: topicId, userId },
    data,
    select: topicSelect,
  });
}

export async function deleteTopic(userId: string, subjectId: string, topicId: string) {
  const topic = await prisma.topic.findFirst({
    where: { id: topicId, subjectId, userId },
    select: { id: true },
  });

  if (!topic) {
    throw new Error("TOPIC_NOT_FOUND");
  }

  return prisma.topic.delete({
    where: { id: topicId, userId },
  });
}
