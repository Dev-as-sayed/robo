import { z } from "zod";
import { getAnalyticsSummary } from "@robo/shared/analytics";
import { getContacts } from "@robo/shared/contacts";
import { getDocuments } from "@robo/shared/documents";
import {
  createExam,
  generatePlan,
  getExam,
  getExams,
  getReadiness,
} from "@robo/shared/exams";
import { generateQuiz } from "@robo/shared/quizzes";
import {
  createReminder,
  deleteReminder,
  getReminders,
  snoozeReminder,
} from "@robo/shared/reminders";
import { getSchedule } from "@robo/shared/schedule";
import {
  completeTodo,
  createTodo,
  deleteTodo,
  getTodos,
  updateTodo,
} from "@robo/shared/todos";
import { searchDocumentChunks } from "../qdrant";
import {
  createRoboTool,
  parseDateTime,
  serializeDate,
  type ToolContext,
} from "./framework";

const isoDate = z
  .string()
  .min(1)
  .describe("An ISO 8601 date or date-time, for example 2026-10-22T18:00:00+03:00.");

const optionalIsoDate = isoDate.optional();

function scheduleWindow(from: string | undefined, to: string | undefined, now: Date) {
  const start = from ? parseDateTime(from, "from") : now;
  const end = to
    ? parseDateTime(to, "to")
    : new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);

  return { start, end };
}

export function buildTools(context: ToolContext) {
  const getScheduleTool = createRoboTool(
    {
      name: "get_schedule",
      description:
        "Get the student's classes and schedule entries. Defaults to the next 7 days. Use this for questions like 'what class is next?'.",
      schema: z.object({
        from: optionalIsoDate.describe("Start of the window. Defaults to now."),
        to: optionalIsoDate.describe("End of the window. Defaults to 7 days after from."),
      }),
      invoke: async ({ from, to }) => {
        const { start, end } = scheduleWindow(from, to, context.now);
        const entries = await getSchedule(context.userId);
        const schedule = entries
          .filter((entry) => entry.startAt >= start && entry.startAt <= end)
          .map((entry) => ({
            id: entry.id,
            title: entry.title,
            description: entry.description,
            startAt: serializeDate(entry.startAt),
            endAt: serializeDate(entry.endAt),
            allDay: entry.allDay,
            subject: entry.subject,
            room: entry.room,
            teacher: entry.teacher,
          }));

        return { ok: true, data: { from: start.toISOString(), to: end.toISOString(), schedule } };
      },
    },
    context
  );

  const listTodosTool = createRoboTool(
    {
      name: "list_todos",
      description:
        "List the student's tasks. Use this before updating or completing a task when the task id is unknown.",
      schema: z.object({
        status: z.enum(["pending", "completed", "snoozed"]).optional(),
        subject: z.string().min(1).max(100).optional(),
        dueBefore: optionalIsoDate,
      }),
      invoke: async (input) => {
        const todos = await getTodos(context.userId, {
          status: input.status,
          subject: input.subject,
          dueBefore: input.dueBefore,
        });

        return {
          ok: true,
          data: {
            todos: todos.map((todo) => ({
              id: todo.id,
              title: todo.title,
              notes: todo.notes,
              dueAt: serializeDate(todo.dueAt),
              subject: todo.subject,
              priority: todo.priority,
              status: todo.status,
            })),
          },
        };
      },
    },
    context
  );

  const createTodoTool = createRoboTool(
    {
      name: "create_todo",
      description:
        "Create a task for the student. Use the student's local time zone when converting relative dates.",
      schema: z.object({
        title: z.string().min(1).max(200).describe("Short task title."),
        dueAt: optionalIsoDate.describe("When the task is due."),
        subject: z.string().min(1).max(100).optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
        notes: z.string().max(5000).optional(),
      }),
      invoke: async (input) => {
        const todo = await createTodo(context.userId, {
          title: input.title,
          due: input.dueAt ? parseDateTime(input.dueAt, "dueAt") : undefined,
          subject: input.subject,
          priority: input.priority,
          notes: input.notes,
        });

        return {
          ok: true,
          data: {
            todo: {
              id: todo.id,
              title: todo.title,
              dueAt: serializeDate(todo.dueAt),
              subject: todo.subject,
              priority: todo.priority,
              status: todo.status,
            },
          },
        };
      },
    },
    context
  );

  const updateTodoTool = createRoboTool(
    {
      name: "update_todo",
      description:
        "Update one of the student's tasks. Only send the fields that should change. Use list_todos first if the id is unknown.",
      schema: z.object({
        todoId: z.string().uuid(),
        title: z.string().min(1).max(200).optional(),
        dueAt: optionalIsoDate,
        subject: z.string().min(1).max(100).nullable().optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
        notes: z.string().max(5000).nullable().optional(),
        status: z.enum(["pending", "completed", "snoozed"]).optional(),
      }),
      invoke: async ({ todoId, dueAt, ...rest }) => {
        const todo = await updateTodo(context.userId, todoId, {
          ...rest,
          ...(dueAt !== undefined
            ? { dueAt: dueAt ? parseDateTime(dueAt, "dueAt") : null }
            : {}),
        });

        return {
          ok: true,
          data: {
            todo: {
              id: todo.id,
              title: todo.title,
              dueAt: serializeDate(todo.dueAt),
              subject: todo.subject,
              priority: todo.priority,
              status: todo.status,
            },
          },
        };
      },
    },
    context
  );

  const completeTodoTool = createRoboTool(
    {
      name: "complete_todo",
      description: "Mark one of the student's tasks as completed.",
      schema: z.object({
        todoId: z.string().uuid().describe("The task id from list_todos."),
      }),
      invoke: async ({ todoId }) => {
        const todo = await completeTodo(context.userId, todoId);
        return {
          ok: true,
          data: { todo: { id: todo.id, title: todo.title, status: todo.status } },
        };
      },
    },
    context
  );

  const deleteTodoTool = createRoboTool(
    {
      name: "delete_todo",
      description:
        "Delete one of the student's tasks. The first call must omit confirm so the student can approve it. Only call again with confirm=true after the student explicitly says yes.",
      schema: z.object({
        todoId: z.string().uuid(),
        confirm: z
          .boolean()
          .default(false)
          .describe("True only after the student explicitly confirmed deletion."),
      }),
      invoke: async ({ todoId, confirm }) => {
        if (!confirm) {
          const todos = await getTodos(context.userId, {});
          const todo = todos.find((entry) => entry.id === todoId);
          if (!todo) {
            throw new Error("TODO_NOT_FOUND");
          }

          return {
            ok: true,
            requiresConfirmation: true,
            data: { todoId, title: todo.title },
            message: `Deleting "${todo.title}" needs confirmation. Ask the student to confirm.`,
          };
        }

        const todo = await deleteTodo(context.userId, todoId);
        return { ok: true, data: { deletedTodoId: todo.id } };
      },
    },
    context
  );

  const listRemindersTool = createRoboTool(
    {
      name: "list_reminders",
      description: "List the student's reminders.",
      schema: z.object({
        status: z.enum(["active", "completed", "snoozed", "expired"]).optional(),
        channel: z.enum(["device", "phone", "push"]).optional(),
      }),
      invoke: async (input) => {
        const reminders = await getReminders(context.userId, input);
        return {
          ok: true,
          data: {
            reminders: reminders.map((reminder) => ({
              id: reminder.id,
              text: reminder.text,
              at: serializeDate(reminder.at),
              rrule: reminder.rrule,
              channels: reminder.channels,
              status: reminder.status,
            })),
          },
        };
      },
    },
    context
  );

  const createReminderTool = createRoboTool(
    {
      name: "create_reminder",
      description:
        "Create a reminder for the student. Use the student's local time zone when converting relative dates.",
      schema: z.object({
        text: z.string().min(1).max(500),
        at: optionalIsoDate,
        rrule: z
          .string()
          .max(500)
          .optional()
          .describe("Optional RFC 5545 recurrence rule, for example FREQ=DAILY."),
        channels: z.array(z.enum(["device", "phone", "push"])).min(1).optional(),
        linkedEntity: z.enum(["todo", "exam", "schedule"]).optional(),
      }),
      invoke: async (input) => {
        const reminder = await createReminder(context.userId, {
          text: input.text,
          at: input.at ? parseDateTime(input.at, "at") : undefined,
          rrule: input.rrule,
          channels: input.channels,
          linkedEntity: input.linkedEntity,
        });

        return {
          ok: true,
          data: {
            reminder: {
              id: reminder.id,
              text: reminder.text,
              at: serializeDate(reminder.at),
              rrule: reminder.rrule,
              status: reminder.status,
            },
          },
        };
      },
    },
    context
  );

  const cancelReminderTool = createRoboTool(
    {
      name: "cancel_reminder",
      description:
        "Cancel one of the student's reminders. The first call must omit confirm so the student can approve it. Only call again with confirm=true after the student explicitly says yes.",
      schema: z.object({
        reminderId: z.string().uuid(),
        confirm: z
          .boolean()
          .default(false)
          .describe("True only after the student explicitly confirmed cancellation."),
      }),
      invoke: async ({ reminderId, confirm }) => {
        if (!confirm) {
          const reminders = await getReminders(context.userId, {});
          const reminder = reminders.find((entry) => entry.id === reminderId);
          if (!reminder) {
            throw new Error("REMINDER_NOT_FOUND");
          }

          return {
            ok: true,
            requiresConfirmation: true,
            data: { reminderId, text: reminder.text },
            message: `Cancelling "${reminder.text}" needs confirmation. Ask the student to confirm.`,
          };
        }

        const reminder = await deleteReminder(context.userId, reminderId);
        return { ok: true, data: { cancelledReminderId: reminder.id } };
      },
    },
    context
  );

  const snoozeReminderTool = createRoboTool(
    {
      name: "snooze_reminder",
      description: "Snooze one of the student's reminders.",
      schema: z.object({
        reminderId: z.string().uuid(),
      }),
      invoke: async ({ reminderId }) => {
        const reminder = await snoozeReminder(context.userId, reminderId);
        return {
          ok: true,
          data: { reminder: { id: reminder.id, text: reminder.text, status: reminder.status } },
        };
      },
    },
    context
  );

  const listExamsTool = createRoboTool(
    {
      name: "list_exams",
      description: "List the student's exams, ordered by date.",
      schema: z.object({
        from: optionalIsoDate,
        to: optionalIsoDate,
        status: z.enum(["draft", "active", "completed"]).optional(),
      }),
      invoke: async (input) => {
        const exams = await getExams(context.userId, {
          from: input.from ? parseDateTime(input.from, "from") : undefined,
          to: input.to ? parseDateTime(input.to, "to") : undefined,
          status: input.status,
        });

        return {
          ok: true,
          data: {
            exams: exams.map((exam) => ({
              id: exam.id,
              subject: exam.subject,
              date: serializeDate(exam.date),
              topics: exam.topics,
              weight: exam.weight,
              status: exam.status,
            })),
          },
        };
      },
    },
    context
  );

  const createExamTool = createRoboTool(
    {
      name: "create_exam",
      description: "Create an exam for the student.",
      schema: z.object({
        subject: z.string().min(1).max(100),
        date: isoDate,
        topics: z.array(z.string().min(1)).optional(),
        weight: z.number().min(0).max(100).optional(),
      }),
      invoke: async (input) => {
        const exam = await createExam(context.userId, {
          subject: input.subject,
          date: parseDateTime(input.date, "date"),
          topics: input.topics,
          weight: input.weight,
        });

        return {
          ok: true,
          data: {
            exam: {
              id: exam.id,
              subject: exam.subject,
              date: serializeDate(exam.date),
              topics: exam.topics,
              status: exam.status,
            },
          },
        };
      },
    },
    context
  );

  const getExamTool = createRoboTool(
    {
      name: "get_exam",
      description: "Get one exam and its preparation details.",
      schema: z.object({
        examId: z.string().uuid(),
      }),
      invoke: async ({ examId }) => {
        const exam = await getExam(context.userId, examId);
        if (!exam) {
          throw new Error("EXAM_NOT_FOUND");
        }

        return {
          ok: true,
          data: {
            exam: {
              id: exam.id,
              subject: exam.subject,
              date: serializeDate(exam.date),
              topics: exam.topics,
              weight: exam.weight,
              status: exam.status,
            },
          },
        };
      },
    },
    context
  );

  const getExamReadinessTool = createRoboTool(
    {
      name: "get_exam_readiness",
      description: "Get the student's preparation percentage for an exam.",
      schema: z.object({
        examId: z.string().uuid(),
      }),
      invoke: async ({ examId }) => {
        const readiness = await getReadiness(context.userId, examId);
        return { ok: true, data: readiness };
      },
    },
    context
  );

  const createStudyPlanTool = createRoboTool(
    {
      name: "create_study_plan",
      description:
        "Create a draft study plan for an exam. The plan must be approved by the student before tasks are scheduled.",
      schema: z.object({
        examId: z.string().uuid(),
        dailyLimit: z.number().int().positive().optional(),
        includeReviews: z.boolean().optional(),
      }),
      invoke: async (input) => {
        const plan = await generatePlan(context.userId, input.examId, {
          dailyLimit: input.dailyLimit,
          includeReviews: input.includeReviews,
        });

        return {
          ok: true,
          data: {
            planId: plan.plan.id,
            examId: plan.plan.examId,
            totalDays: plan.plan.totalDays,
            dailyTasks: plan.dailyTasks,
            requiresApproval: true,
          },
        };
      },
    },
    context
  );

  const getAnalyticsSummaryTool = createRoboTool(
    {
      name: "get_analytics_summary",
      description:
        "Get a summary of the student's study activity: completed tasks, quizzes, reminders, and upcoming exams.",
      schema: z.object({
        range: z.enum(["day", "week", "month", "year"]).default("week"),
      }),
      invoke: async ({ range }) => {
        const summary = await getAnalyticsSummary(context.userId, { range });
        return { ok: true, data: summary };
      },
    },
    context
  );

  const findContactTool = createRoboTool(
    {
      name: "find_contact",
      description:
        "Find a contact by name, phone number, or email. Use this before preparing a call or message.",
      schema: z.object({
        query: z.string().min(1).max(100),
      }),
      invoke: async ({ query }) => {
        const normalized = query.trim().toLowerCase();
        const contacts = await getContacts(context.userId);
        const matches = contacts.filter((contact) =>
          [contact.name, contact.phone, contact.email, contact.group]
            .filter((value): value is string => Boolean(value))
            .some((value) => value.toLowerCase().includes(normalized))
        );

        return {
          ok: true,
          data: {
            contacts: matches.map((contact) => ({
              id: contact.id,
              name: contact.name,
              phone: contact.phone,
              email: contact.email,
              group: contact.group,
            })),
          },
        };
      },
    },
    context
  );

  const listDocumentsTool = createRoboTool(
    {
      name: "list_documents",
      description: "List the student's uploaded study documents.",
      schema: z.object({
        subject: z.string().min(1).max(100).optional(),
      }),
      invoke: async ({ subject }) => {
        const documents = await getDocuments(context.userId);
        const filtered = subject
          ? documents.filter((document) =>
              document.subject?.toLowerCase().includes(subject.toLowerCase())
            )
          : documents;

        return {
          ok: true,
          data: {
            documents: filtered.map((document) => ({
              id: document.id,
              originalName: document.originalName,
              subject: document.subject,
              status: document.status,
              chunkCount: document.chunkCount,
              createdAt: document.createdAt.toISOString(),
            })),
          },
        };
      },
    },
    context
  );

  const searchDocumentsTool = createRoboTool(
    {
      name: "search_documents",
      description:
        "Search the student's indexed study documents. Always answer from the returned passages and cite the document source. Never use another student's materials.",
      schema: z.object({
        query: z.string().min(2).max(500),
        documentId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(10).default(6),
      }),
      invoke: async ({ query, documentId, limit }) => {
        const chunks = await searchDocumentChunks(context.userId, query, {
          documentId,
          limit,
        });

        return {
          ok: true,
          data: {
            chunks: chunks.map((chunk) => ({
              documentId: chunk.documentId,
              page: chunk.page,
              source: chunk.source,
              text: chunk.text,
              score: chunk.score,
            })),
          },
        };
      },
    },
    context
  );

  const generateQuizTool = createRoboTool(
    {
      name: "generate_quiz",
      description:
        "Generate a practice quiz for the student on a subject and topic. Use get_subject_topics or ask the student if the topic is unclear.",
      schema: z.object({
        subject: z.string().min(1).max(100),
        topic: z.string().min(1).max(200),
        questionCount: z.number().int().min(1).max(50),
        difficulty: z.enum(["easy", "medium", "hard"]).optional(),
      }),
      invoke: async (input) => {
        const result = await generateQuiz(context.userId, input);
        return {
          ok: true,
          data: {
            quizId: result.quiz.id,
            title: result.quiz.title,
            subject: result.quiz.subject,
            topic: result.quiz.topic,
            questionCount: result.quiz.questionCount,
            createdAt: result.generatedAt.toISOString(),
          },
        };
      },
    },
    context
  );

  const getCurrentTimeTool = createRoboTool(
    {
      name: "get_current_time",
      description: "Get the student's current local date and time.",
      schema: z.object({}),
      invoke: async () => {
        let localTime: string;
        try {
          localTime = new Intl.DateTimeFormat("en-GB", {
            dateStyle: "full",
            timeStyle: "short",
            timeZone: context.timezone,
          }).format(context.now);
        } catch {
          localTime = context.now.toISOString();
        }

        return {
          ok: true,
          data: {
            utc: context.now.toISOString(),
            localTime,
            timezone: context.timezone,
            locale: context.locale,
          },
        };
      },
    },
    context
  );

  return [
    getCurrentTimeTool,
    getScheduleTool,
    listTodosTool,
    createTodoTool,
    updateTodoTool,
    completeTodoTool,
    deleteTodoTool,
    listRemindersTool,
    createReminderTool,
    cancelReminderTool,
    snoozeReminderTool,
    listExamsTool,
    createExamTool,
    getExamTool,
    getExamReadinessTool,
    createStudyPlanTool,
    getAnalyticsSummaryTool,
    findContactTool,
    listDocumentsTool,
    searchDocumentsTool,
    generateQuizTool,
  ];
}
