import { DateTime } from "luxon";

export interface PlannerTask {
  id: string;
  title: string;
  dueAt: Date | null;
  priority: string;
  subject?: string | null;
}

export interface PlannerExam {
  id: string;
  subject: string;
  date: Date;
}

export interface PlannerReminder {
  id: string;
  text: string;
  nextAt: Date | null;
}

export interface PlannerClass {
  title: string;
  startAt: Date;
  endAt: Date | null;
  room?: string | null;
}

export interface PlannedTask extends PlannerTask {
  reason: string;
}

export interface DailyPlan {
  date: string;
  summary: string;
  tasks: PlannedTask[];
  exams: PlannerExam[];
  reminders: PlannerReminder[];
  nextClass: PlannerClass | null;
  activeSession: { subject: string | null; startedAt: Date } | null;
}

export interface DailyPlanInput {
  now: Date;
  timezone: string;
  tasks: PlannerTask[];
  exams: PlannerExam[];
  reminders: PlannerReminder[];
  classes: PlannerClass[];
  activeSession: { subject: string | null; startedAt: Date } | null;
}

const PRIORITY_SCORE: Record<string, number> = {
  urgent: 30,
  high: 20,
  medium: 10,
  low: 0,
};

function localDay(instant: Date, timezone: string): DateTime {
  return DateTime.fromJSDate(instant, { zone: timezone }).startOf("day");
}

export function taskUrgency(
  task: PlannerTask,
  now: Date,
  timezone: string
): { score: number; reason: string } {
  const priority = PRIORITY_SCORE[task.priority] ?? 0;
  if (!task.dueAt) {
    return { score: priority + 5, reason: "No due date" };
  }

  const today = localDay(now, timezone);
  const due = localDay(task.dueAt, timezone);
  const days = Math.round(due.diff(today, "days").days);

  if (days < 0) {
    return {
      score: priority + 100 + Math.min(30, Math.abs(days)),
      reason: days === -1 ? "Overdue since yesterday" : `Overdue by ${Math.abs(days)} days`,
    };
  }
  if (days === 0) {
    return { score: priority + 70, reason: "Due today" };
  }
  if (days === 1) {
    return { score: priority + 45, reason: "Due tomorrow" };
  }
  if (days <= 7) {
    return { score: priority + 25, reason: `Due in ${days} days` };
  }

  return { score: priority, reason: `Due in ${days} days` };
}

export function rankTasks(
  tasks: PlannerTask[],
  now: Date,
  timezone: string,
  limit = 6
): PlannedTask[] {
  return tasks
    .map(task => {
      const urgency = taskUrgency(task, now, timezone);
      return { ...task, ...urgency };
    })
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit)
    .map(({ score: _score, ...task }) => task);
}

function nextClassToday(
  classes: PlannerClass[],
  now: Date,
  timezone: string
): PlannerClass | null {
  const today = DateTime.fromJSDate(now, { zone: timezone }).startOf("day");
  return (
    [...classes]
      .filter(entry => {
        const start = DateTime.fromJSDate(entry.startAt, { zone: timezone });
        return start >= DateTime.fromJSDate(now, { zone: timezone }) && start.hasSame(today, "day");
      })
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())[0] ?? null
  );
}

export function buildDailyPlan(input: DailyPlanInput): DailyPlan {
  const local = DateTime.fromJSDate(input.now, { zone: input.timezone });
  const date = local.toISODate() ?? input.now.toISOString().slice(0, 10);
  const tasks = rankTasks(input.tasks, input.now, input.timezone).map(task => ({
    ...task,
  }));
  const exams = [...input.exams]
    .filter(exam => exam.date >= input.now)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 3);
  const reminders = [...input.reminders]
    .filter(
      reminder =>
        reminder.nextAt &&
        reminder.nextAt > input.now &&
        DateTime.fromJSDate(reminder.nextAt, { zone: input.timezone }).hasSame(local, "day")
    )
    .sort((a, b) => a.nextAt!.getTime() - b.nextAt!.getTime())
    .slice(0, 5);
  const nextClass = nextClassToday(input.classes, input.now, input.timezone);

  const parts: string[] = [];
  if (input.activeSession) {
    parts.push(
      `A${input.activeSession.subject ? ` ${input.activeSession.subject}` : ""} study session is already running`
    );
  }
  if (tasks.length > 0) {
    parts.push(`start with "${tasks[0].title}" (${tasks[0].reason.toLowerCase()})`);
  }
  if (nextClass) {
    parts.push(`next class is ${nextClass.title}`);
  }
  if (exams.length > 0) {
    const days = Math.max(
      0,
      Math.ceil(
        DateTime.fromJSDate(exams[0].date, { zone: input.timezone })
          .startOf("day")
          .diff(local.startOf("day"), "days").days
      )
    );
    parts.push(
      days === 0
        ? `${exams[0].subject} exam is today`
        : `${exams[0].subject} exam is in ${days} day${days === 1 ? "" : "s"}`
    );
  }

  const summary =
    parts.length > 0
      ? `${parts.join("; ")}.`
      : "Nothing urgent is scheduled. Add a task or start a study session.";

  return { date, summary, tasks, exams, reminders, nextClass, activeSession: input.activeSession };
}
