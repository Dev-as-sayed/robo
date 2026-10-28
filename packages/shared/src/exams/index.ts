import { DateTime } from "luxon";
import { prisma } from "../lib/prisma";
import { computeReminderNextAt } from "../reminders";

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

export async function getExams(
  userId: string,
  filters: { from?: Date; to?: Date; status?: "draft" | "active" | "completed" } = {}
) {
  return prisma.exam.findMany({
    where: {
      userId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.from || filters.to
        ? {
            date: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    },
    orderBy: { date: "asc" },
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

export async function approvePlan(
  userId: string,
  planId: string,
  now: Date = new Date()
) {
  const plan = await prisma.studyPlan.findFirst({
    where: { id: planId, userId },
    include: {
      exam: true,
      dailyTasks: { orderBy: { day: "asc" } },
    },
  });

  if (!plan) {
    throw new Error("PLAN_NOT_FOUND");
  }

  if (plan.approvedAt) {
    return { plan, todosCreated: 0, reminderId: plan.reminderId };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  const timezone = user?.timezone || "UTC";
  const local = DateTime.fromJSDate(now, { zone: timezone });
  const examDay = DateTime.fromJSDate(plan.exam.date, { zone: timezone }).endOf("day");
  const firstStudySlot = local.startOf("day").set({ hour: 18, minute: 0, second: 0 });
  const reminderAt =
    firstStudySlot > local && firstStudySlot <= examDay ? firstStudySlot : null;
  const rrule = reminderAt
    ? `FREQ=DAILY;UNTIL=${examDay.set({ hour: 17, minute: 59, second: 0, millisecond: 0 }).toFormat("yyyyMMdd'T'HHmmss")}`
    : null;

  const result = await prisma.$transaction(async (tx) => {
    let todosCreated = 0;
    const linked: Array<{ taskId: string; todoId: string }> = [];

    for (const task of plan.dailyTasks) {
      if (task.todoId) {
        continue;
      }

      const dueAt = local
        .startOf("day")
        .plus({ days: task.day - 1 })
        .set({ hour: 18, minute: 0, second: 0 })
        .toJSDate();
      const todo = await tx.todo.create({
        data: {
          userId,
          title: task.title,
          notes: `Study plan for ${plan.exam.subject}, day ${task.day}.`,
          subject: plan.exam.subject,
          dueAt,
          priority: "medium",
          status: "pending",
        },
        select: { id: true },
      });

      await tx.dailyTask.update({
        where: { id: task.id },
        data: { todoId: todo.id },
      });
      linked.push({ taskId: task.id, todoId: todo.id });
      todosCreated += 1;
    }

    let reminderId: string | null = null;
    if (reminderAt && rrule) {
      const reminder = await tx.reminder.create({
        data: {
          userId,
          text: `Study for ${plan.exam.subject}`,
          at: reminderAt.toJSDate(),
          rrule,
          nextAt: computeReminderNextAt(
            { at: reminderAt.toJSDate(), rrule },
            now,
            timezone
          ),
          channels: ["device", "push"],
          linkedEntity: "exam",
          status: "active",
        },
        select: { id: true },
      });
      reminderId = reminder.id;
    }

    await tx.studyPlan.update({
      where: { id: plan.id },
      data: { approvedAt: now, reminderId },
    });
    await tx.exam.update({
      where: { id: plan.examId, userId },
      data: { status: "active" },
    });

    return { todosCreated, reminderId, linked };
  });

  return {
    plan: {
      ...plan,
      approvedAt: now,
      reminderId: result.reminderId,
      dailyTasks: plan.dailyTasks.map(task => ({
        ...task,
        todoId:
          result.linked.find(row => row.taskId === task.id)?.todoId ?? task.todoId,
      })),
    },
    todosCreated: result.todosCreated,
    reminderId: result.reminderId,
  };
}

export async function recalculatePlan(
  userId: string,
  examId: string,
  now: Date = new Date()
) {
  const plan = await prisma.studyPlan.findFirst({
    where: { examId, userId },
    include: {
      exam: true,
      dailyTasks: {
        orderBy: { day: "asc" },
        include: { todo: { select: { id: true, status: true } } },
      },
    },
  });

  if (!plan) {
    throw new Error("PLAN_NOT_FOUND");
  }
  if (!plan.approvedAt) {
    throw new Error("PLAN_NOT_APPROVED");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  const timezone = user?.timezone || "UTC";
  const local = DateTime.fromJSDate(now, { zone: timezone });
  const examDay = DateTime.fromJSDate(plan.exam.date, { zone: timezone }).startOf("day");
  const daysLeft = Math.max(1, Math.floor(examDay.diff(local.startOf("day"), "days").days) + 1);

  const remaining = plan.dailyTasks.filter(
    task => !task.completed && task.todo?.status !== "completed"
  );
  if (remaining.length === 0) {
    return { rescheduled: 0, preparedness: 100, daysLeft };
  }

  const perDay = Math.ceil(remaining.length / daysLeft);
  const updates = remaining.map(task => {
    const day = Math.min(daysLeft, Math.floor(remaining.indexOf(task) / perDay) + 1);
    const dueAt = local
      .startOf("day")
      .plus({ days: day - 1 })
      .set({ hour: 18, minute: 0, second: 0, millisecond: 0 })
      .toJSDate();

    return { task, day, dueAt };
  });

  await prisma.$transaction(async tx => {
    for (const update of updates) {
      if (update.task.todo) {
        await tx.todo.update({
          where: { id: update.task.todo.id, userId },
          data: { dueAt: update.dueAt, warned24hAt: null, warned2hAt: null },
        });
      }
      await tx.dailyTask.update({
        where: { id: update.task.id },
        data: { day: update.day },
      });
    }
  });

  const completed = plan.dailyTasks.length - remaining.length;
  const preparedness =
    plan.dailyTasks.length > 0
      ? Math.round((completed / plan.dailyTasks.length) * 100)
      : 0;

  return { rescheduled: remaining.length, preparedness, daysLeft };
}

export async function getReadiness(userId: string, examId: string) {
  const exam = await prisma.exam.findFirst({
    where: { id: examId, userId },
    include: {
      studyPlan: {
        include: {
          dailyTasks: {
            include: {
              todo: { select: { status: true } },
            },
          },
        },
      },
    },
  });

  if (!exam) {
    throw new Error("EXAM_NOT_FOUND");
  }

  const plan = exam.studyPlan;
  const dailyTasks = plan?.dailyTasks ?? [];
  const totalTasks = dailyTasks.length;
  const isDone = (task: (typeof dailyTasks)[number]): boolean =>
    task.completed || task.todo?.status === "completed";
  const completed = dailyTasks.filter(isDone);
  const preparedness =
    totalTasks > 0 ? Math.round((completed.length / totalTasks) * 100) : 0;

  const coveredText = completed.map(task => task.title.toLowerCase()).join(" ");
  const remainingTopics =
    exam.topics?.filter(topic => !coveredText.includes(topic.toLowerCase())) ?? [];

  const missingTasks = dailyTasks.filter(task => !isDone(task)).map(task => task.title);

  return {
    preparedness,
    remainingTopics,
    missingTasks,
  };
}
export interface RevisionSummaryInput {
  examSubject: string;
  daysLeft: number;
  preparedness: number;
  missingTasks: string[];
  remainingTopics: string[];
  weakTopics: string[];
  quizAverage: number | null;
  nextTask: { title: string; dueAt: Date | null } | null;
}

export function buildRevisionNarrative(input: RevisionSummaryInput): string {
  const parts: string[] = [];

  if (input.missingTasks.length === 0) {
    parts.push(`All planned tasks for ${input.examSubject} are complete.`);
  } else {
    parts.push(
      `${input.missingTasks.length} task${input.missingTasks.length === 1 ? "" : "s"} left for ${input.examSubject} (${input.preparedness}% prepared).`
    );
  }

  if (input.nextTask) {
    parts.push(`Next: ${input.nextTask.title}.`);
  }

  if (input.weakTopics.length > 0) {
    parts.push(`Focus on ${input.weakTopics.slice(0, 3).join(", ")}.`);
  } else if (input.remainingTopics.length > 0) {
    parts.push(`Still uncovered: ${input.remainingTopics.slice(0, 3).join(", ")}.`);
  }

  if (input.quizAverage !== null) {
    parts.push(`Recent quiz average: ${input.quizAverage}%.`);
  }

  if (input.daysLeft <= 3 && input.missingTasks.length > 0) {
    parts.push("The exam is close, so prioritise the next task tonight.");
  }

  return parts.join(" ");
}

export async function getRevisionSummary(
  userId: string,
  examId: string,
  now: Date = new Date()
) {
  const exam = await prisma.exam.findFirst({
    where: { id: examId, userId },
    select: { subject: true, date: true },
  });
  if (!exam) throw new Error("EXAM_NOT_FOUND");

  const [readiness, subject, attempts, nextDailyTask, user] = await Promise.all([
    getReadiness(userId, examId),
    prisma.subject.findFirst({
      where: { userId, name: exam.subject },
      select: {
        topics: { select: { name: true, masteryScore: true } },
      },
    }),
    prisma.quizAttempt.findMany({
      where: {
        userId,
        score: { not: null },
        quiz: { userId, subject: exam.subject },
      },
      orderBy: { answeredAt: "desc" },
      take: 5,
      select: { score: true },
    }),
    prisma.dailyTask.findFirst({
      where: {
        plan: { examId, userId },
        completed: false,
        todo: { isNot: null },
      },
      orderBy: { day: "asc" },
      select: { title: true, todo: { select: { dueAt: true } } },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    }),
  ]);

  const timezone = user?.timezone || "UTC";
  const local = DateTime.fromJSDate(now, { zone: timezone });
  const examDay = DateTime.fromJSDate(exam.date, { zone: timezone }).startOf("day");
  const daysLeft = Math.max(
    0,
    Math.ceil(examDay.diff(local.startOf("day"), "days").days)
  );

  const weakTopics = (subject?.topics ?? [])
    .filter(topic => topic.masteryScore < 60)
    .map(topic => topic.name);
  const scores = attempts
    .map(attempt => attempt.score)
    .filter((score): score is number => score !== null);
  const quizAverage =
    scores.length > 0
      ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
      : null;
  const nextTask = nextDailyTask
    ? {
        title: nextDailyTask.title,
        dueAt: nextDailyTask.todo?.dueAt ?? null,
      }
    : null;

  return {
    examSubject: exam.subject,
    daysLeft,
    preparedness: readiness.preparedness,
    remainingTopics: readiness.remainingTopics,
    missingTasks: readiness.missingTasks,
    weakTopics,
    quizAverage,
    nextTask,
    narrative: buildRevisionNarrative({
      examSubject: exam.subject,
      daysLeft,
      preparedness: readiness.preparedness,
      remainingTopics: readiness.remainingTopics,
      missingTasks: readiness.missingTasks,
      weakTopics,
      quizAverage,
      nextTask,
    }),
  };
}
