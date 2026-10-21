import { prisma } from "../lib/prisma";

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

export async function createSchedule(userId: string, data: {
  title: string;
  description?: string;
  startAt: Date;
  endAt?: Date;
  allDay?: boolean;
  subject?: string;
  room?: string;
  teacher?: string;
}) {
  return await prisma.scheduleEntry.create({
    data: {
      userId,
      title: data.title,
      description: data.description,
      startAt: data.startAt,
      endAt: data.endAt,
      allDay: data.allDay ?? false,
      subject: data.subject,
      room: data.room,
      teacher: data.teacher,
    },
    select: {
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
      createdAt: true,
      updatedAt: true,
    },
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
      createdAt: true,
    },
  });
}

export async function updateSchedule(userId: string, scheduleId: string, data: any) {
  return await prisma.scheduleEntry.update({
    where: { id: scheduleId, userId },
    data,
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
      createdAt: true,
      updatedAt: true,
    },
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