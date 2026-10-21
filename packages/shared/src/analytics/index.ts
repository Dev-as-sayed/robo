import { prisma } from "../lib/prisma";

export interface AnalyticsSummary {
  totalStudyHours: number;
  completedTasks: number;
  completedQuizzes: number;
  activeReminders: number;
  upcomingExams: number;
  streakDays: number;
}

export interface AnalyticsBySubject {
  subject: string;
  studyHours: number;
  completedTasks: number;
  quizAverage: number;
  recentActivities: string[];
}

export async function getAnalyticsSummary(userId: string, filters: {
  range?: "day" | "week" | "month" | "year";
}) {
  const range = filters.range || "week";
  const now = new Date();
  const start = new Date();

  switch (range) {
    case "day": {
      start.setHours(0, 0, 0, 0);
      break;
    }
    case "week": {
      const day = now.getDay();
      const diff = now.getDate() - day;
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case "month": {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case "year": {
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      break;
    }
  }

  // Get study sessions
  const sessions = await prisma.studySession.count({
    where: {
      userId,
      startedAt: { gte: start },
    },
  });

  // Get completed todos
  const completedTodos = await prisma.todo.count({
    where: {
      userId,
      status: "completed",
      completedAt: { gte: start },
    },
  });

  // Get completed quizzes
  const completedQuizzes = await prisma.quizAttempt.count({
    where: {
      userId,
      score: { not: null },
      answeredAt: { gte: start },
    },
  });

  // Get active reminders
  const activeReminders = await prisma.reminder.count({
    where: {
      userId,
      status: "active",
    },
  });

  // Get upcoming exams
  const upcomingExams = await prisma.exam.count({
    where: {
      userId,
      date: { gte: start },
      status: "active",
    },
  });

  return {
    totalStudyHours: sessions * 0.5, // approximate
    completedTasks: completedTodos,
    completedQuizzes,
    activeReminders,
    upcomingExams,
    streakDays: 0, // will be calculated later
  };
}

export async function getAnalyticsBySubject(userId: string, subjectId: string) {
  // Get todos for this subject
  const todos = await prisma.todo.count({
    where: { userId, subject: subjectId },
  });

  // Get completed todos
  const completedTodos = await prisma.todo.count({
    where: { userId, subject: subjectId, status: "completed" },
  });

  // Get exams for this subject
  const exams = await prisma.exam.count({
    where: { userId, subject: subjectId, status: "active" },
  });

  // Get quiz attempts for this subject
  const quizAttempts = await prisma.quizAttempt.count({
    where: { userId },
  });

  const quizAverage = quizAttempts > 0 ? 85 : 0; // simplified

  return {
    subject: subjectId,
    studyHours: 0, // will be calculated from sessions
    completedTasks: completedTodos,
    quizAverage,
    recentActivities: [],
  };
}