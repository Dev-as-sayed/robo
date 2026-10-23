import { prisma } from "../lib/prisma";
import { computeAlertAt } from "./alerts";

export * from "./alerts";

const scheduleSelect = {
  id: true,
  userId: true,
  title: true,
  description: true,
  startAt: true,
  endAt: true,
  allDay: true,
  subject: true,
  room: true,
  teacher: true,
  alertLeadMinutes: true,
  alertAt: true,
  alertedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface ScheduleEntry {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  startAt: Date;
  endAt: Date | null;
  allDay: boolean;
  subject: string | null;
  room: string | null;
  teacher: string | null;
  alertLeadMinutes: number | null;
  alertAt: Date | null;
  alertedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduleException {
  id: string;
  scheduleId: string;
  date: Date;
  reason: string | null;
  createdAt: Date;
}

export async function createSchedule(
  userId: string,
  data: {
    title: string;
    description?: string;
    startAt: Date;
    endAt?: Date;
    allDay?: boolean;
    subject?: string;
    room?: string;
    teacher?: string;
    alertLeadMinutes?: number;
  }
) {
  const allDay = data.allDay ?? false;
  const alertLeadMinutes = data.alertLeadMinutes ?? null;

  return await prisma.scheduleEntry.create({
    data: {
      userId,
      title: data.title,
      description: data.description,
      startAt: data.startAt,
      endAt: data.endAt,
      allDay,
      subject: data.subject,
      room: data.room,
      teacher: data.teacher,
      alertLeadMinutes,
      alertAt: computeAlertAt({ startAt: data.startAt, allDay, alertLeadMinutes }),
    },
    select: scheduleSelect,
  });
}

export async function getSchedule(userId: string) {
  return await prisma.scheduleEntry.findMany({
    where: { userId },
    orderBy: { startAt: "asc" },
    select: {
      id: true,
      title: true,
      description: true,
      startAt: true,
      endAt: true,
      allDay: true,
      subject: true,
      room: true,
      teacher: true,
      alertLeadMinutes: true,
      alertAt: true,
      createdAt: true,
    },
  });
}

export interface UpdateScheduleInput {
  title?: string;
  description?: string | null;
  startAt?: Date;
  endAt?: Date | null;
  allDay?: boolean;
  subject?: string | null;
  room?: string | null;
  teacher?: string | null;
  alertLeadMinutes?: number | null;
}

export async function updateSchedule(
  userId: string,
  scheduleId: string,
  data: UpdateScheduleInput
) {
  const current = await prisma.scheduleEntry.findFirst({
    where: { id: scheduleId, userId },
    select: { startAt: true, allDay: true, alertLeadMinutes: true },
  });

  if (!current) {
    throw new Error("SCHEDULE_NOT_FOUND");
  }

  const startAt = data.startAt !== undefined ? data.startAt : current.startAt;
  const allDay = data.allDay !== undefined ? data.allDay : current.allDay;
  const alertLeadMinutes =
    data.alertLeadMinutes !== undefined ? data.alertLeadMinutes : current.alertLeadMinutes;

  // Moving a class reopens its alert: the previous slot is gone and an already
  // announced class must be able to announce again at the new time.
  const rescheduled = startAt.getTime() !== current.startAt.getTime();

  return await prisma.scheduleEntry.update({
    where: { id: scheduleId, userId },
    data: {
      ...data,
      allDay,
      alertLeadMinutes,
      alertAt: computeAlertAt({ startAt, allDay, alertLeadMinutes }),
      ...(rescheduled ? { alertedAt: null } : {}),
    },
    select: scheduleSelect,
  });
}

export async function deleteSchedule(userId: string, scheduleId: string) {
  return await prisma.scheduleEntry.delete({
    where: { id: scheduleId, userId },
  });
}

export async function addException(userId: string, scheduleId: string, data: {
  date: Date;
  reason?: string;
}) {
  return await prisma.scheduleException.create({
    data: {
      scheduleId,
      userId,
      date: data.date,
      reason: data.reason,
    },
    select: {
      id: true,
      scheduleId: true,
      date: true,
      reason: true,
      createdAt: true,
    },
  });
}