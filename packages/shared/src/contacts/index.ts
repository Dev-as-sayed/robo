import { prisma } from "../lib/prisma";

export interface Contact {
  id: string;
  userId: string;
  name: string;
  phone: string | null;
  email: string | null;
  group: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function getContacts(userId: string) {
  return await prisma.contact.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      userId: true,
      name: true,
      phone: true,
      email: true,
      group: true,
      createdAt: true,
    },
  });
}

export async function createContact(userId: string, data: {
  name: string;
  phone?: string;
  email?: string;
  group?: string;
}) {
  return await prisma.contact.create({
    data: {
      userId,
      name: data.name,
      phone: data.phone,
      email: data.email,
      group: data.group,
    },
    select: {
      id: true,
      userId: true,
      name: true,
      phone: true,
      email: true,
      group: true,
      createdAt: true,
    },
  });
}

export async function deleteContact(userId: string, contactId: string) {
  return await prisma.contact.delete({
    where: { id: contactId, userId },
  });
}