import { prisma } from "../lib/prisma";

export interface Reminder {
  id: string;
  userId: string;
  text: string;
  at: Date | null;
  rrule: string | null;
  channels: ("device" | "phone" | "push")[];
  linkedEntity: "todo" | "exam" | "schedule" | null;
  status: "active" | "completed" | "snoozed" | "expired";
  createdAt: Date;
  updatedAt: Date;
}

export async function createReminder(userId: string, data: {
  text: string;
  at?: Date;
  rrule?: string;
  channels?: ("device" | "phone" | "push")[];
  linkedEntity?: "todo" | "exam" | "schedule";
}) {
  return await prisma.reminder.create({
    data: {
      userId,
      text: data.text,
      at: data.at,
      rrule: data.rrule,
      channels: data.channels ?? ["device", "phone", "push"],
      linkedEntity: data.linkedEntity,
      status: "active",
    },
    select: {
      id: true,
      userId: true,
      text: true,
      at: true,
      rrule: true,
      channels: true,
      linkedEntity: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getReminders(userId: string, filters: {
  status?: string;
  channel?: string;
}) {
  const where: any = { userId };

  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.channel) {
    where.channels = { has: filters.channel };
  }

  return await prisma.reminder.findMany({
    where,
    orderBy: { at: "asc" },
    select: {
      id: true,
      userId: true,
      text: true,
      at: true,
      rrule: true,
      channels: true,
      linkedEntity: true,
      status: true,
      createdAt: true,
    },
  });
}

export async function updateReminder(userId: string, reminderId: string, data: any) {
  return await prisma.reminder.update({
    where: { id: reminderId, userId },
    data,
    select: {
      id: true,
      userId: true,
      text: true,
      at: true,
      rrule: true,
      channels: true,
      linkedEntity: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function deleteReminder(userId: string, reminderId: string) {
  return await prisma.reminder.delete({
    where: { id: reminderId, userId },
  });
}

export async function snoozeReminder(userId: string, reminderId: string) {
  return await prisma.reminder.update({
    where: { id: reminderId, userId },
    data: { status: "snoozed" },
    select: {
      id: true,
      userId: true,
      text: true,
      at: true,
      rrule: true,
      channels: true,
      linkedEntity: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}