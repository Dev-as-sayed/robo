import { prisma } from "../lib/prisma";

export interface Exam {
  id: string;
  userId: string;
  subject: string;
  date: Date;
  topics: string[];
  weight: number | null;
  status: "draft" | "active" | "completed";
  createdAt: Date;
  updatedAt: Date;
}

export interface StudyPlan {
  id: string;
  examId: string;
  userId: string;
  totalDays: number;
  dailyTasks: DailyTask[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DailyTask {
  id: string;
  planId: string;
  day: number;
  title: string;
  completed: boolean;
  createdAt: Date;
}

export interface ReadinessResult {
  preparedness: number; // 0-100
  remainingTopics: string[];
  missingTasks: string[];
}

export async function createExam(userId: string, data: {
  subject: string;
  date: Date | string;
  topics?: string[];
  weight?: number;
}) {
  return await prisma.exam.create({
    data: {
      userId,
      subject: data.subject,
      date: typeof data.date === "string" ? new Date(data.date) : data.date,
      topics: data.topics ?? [],
      weight: data.weight,
      status: "draft",
    },
    select: {
      id: true,
      userId: true,
      subject: true,
      date: true,
      topics: true,
      weight: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getExam(userId: string, examId: string) {
  return await prisma.exam.findFirst({
    where: { id: examId, userId },
    select: {
      id: true,
      userId: true,
      subject: true,
      date: true,
      topics: true,
      weight: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function updateExam(userId: string, examId: string, data: any) {
  return await prisma.exam.update({
    where: { id: examId, userId },
    data,
    select: {
      id: true,
      userId: true,
      subject: true,
      date: true,
      topics: true,
      weight: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function deleteExam(userId: string, examId: string) {
  return await prisma.exam.delete({
    where: { id: examId, userId },
  });
}

export async function generatePlan(userId: string, examId: string, data: {
  dailyLimit?: number;
  includeReviews?: boolean;
}) {
  const exam = await prisma.exam.findFirst({
    where: { id: examId, userId },
  });

  if (!exam) {
    throw new Error("EXAM_NOT_FOUND");
  }

  const examDate = exam.date instanceof Date ? exam.date : new Date(exam.date);
  const today = new Date();
  const totalDays = Math.max(1, Math.ceil((examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

  const dailyTasks = [];
  for (let i = 0; i < totalDays; i++) {
    dailyTasks.push({
      id: `${examId}-day-${i}`,
      planId: "", // will be set after creation
      day: i + 1,
      title: `Study topic for ${exam.subject} - Day ${i + 1}`,
      completed: false,
    });
  }

  const plan = await prisma.studyPlan.create({
    data: {
      examId,
      userId,
      totalDays,
      dailyTasks: {
        create: dailyTasks.map(task => ({
          day: task.day,
          title: task.title,
          completed: false,
        })),
      },
    },
    select: {
      id: true,
      examId: true,
      userId: true,
      totalDays: true,
      dailyTasks: {
        select: {
          id: true,
          planId: true,
          day: true,
          title: true,
          completed: true,
        },
      },
      createdAt: true,
      updatedAt: true,
    },
  });

  return {
    plan,
    dailyTasks: plan.dailyTasks.map((t: any) => ({
      id: t.id,
      day: t.day,
      title: t.title,
      completed: t.completed,
    })),
  };
}

export async function approvePlan(userId: string, planId: string) {
  const plan = await prisma.studyPlan.findFirst({
    where: { id: planId },
    include: {
      exam: true,
      dailyTasks: true,
    },
  });

  if (!plan) {
    throw new Error("PLAN_NOT_FOUND");
  }

  // Mark all tasks as created/synced
  await prisma.studyPlan.update({
    where: { id: planId },
    data: {
      dailyTasks: {
        updateMany: {
          where: { completed: false },
          data: { completed: true }, // Mark as created
        },
      },
    },
  });

  return {
    plan,
    message: "Study plan approved and todos/reminders will be created",
  };
}

export async function getReadiness(userId: string, examId: string) {
  const exam = await prisma.exam.findFirst({
    where: { id: examId, userId },
    include: {
      studyPlan: {
        include: {
          dailyTasks: true,
        },
      },
    },
  });

  if (!exam) {
    throw new Error("EXAM_NOT_FOUND");
  }

  const plan = exam.studyPlan;
  const totalTasks = plan?.dailyTasks.length || 0;
  const completedTasks = plan?.dailyTasks.filter((t: any) => t.completed).length || 0;
  const preparedness = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const remainingTopics = exam.topics?.filter((t: string) => {
    // Check if topic is covered by completed tasks
    return true; // simplified
  }) || [];

  const missingTasks = plan?.dailyTasks.filter((t: any) => !t.completed).map((t: any) => t.title) || [];

  return {
    preparedness,
    remainingTopics,
    missingTasks,
  };
}