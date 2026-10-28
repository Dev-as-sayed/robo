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
      updatedAt: true,
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

export async function updateContact(
  userId: string,
  contactId: string,
  data: {
    name?: string;
    phone?: string;
    email?: string;
    group?: string;
  }
) {
  const current = await prisma.contact.findFirst({
    where: { id: contactId, userId },
    select: { id: true },
  });

  if (!current) {
    throw new Error("CONTACT_NOT_FOUND");
  }

  return prisma.contact.update({
    where: { id: contactId, userId },
    data,
    select: {
      id: true,
      userId: true,
      name: true,
      phone: true,
      email: true,
      group: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function deleteContact(userId: string, contactId: string) {
  return await prisma.contact.delete({
    where: { id: contactId, userId },
  });
}
function normalizePhone(value: string): string {
  return value.replace(/[^\d+]/g, "");
}

export interface ContactMatch {
  contact: Contact;
  score: number;
}

/**
 * Ranks contacts by exact name/email/phone first, then prefix, then substring.
 * More than one leading match (or more than one exact match) is ambiguous.
 */
export function matchContacts(
  contacts: readonly Contact[],
  query: string
): { matches: ContactMatch[]; ambiguous: boolean } {
  const normalized = query.trim().toLowerCase();
  const queryPhone = normalizePhone(normalized);

  if (!normalized) {
    return { matches: [], ambiguous: false };
  }

  const matches = contacts
    .map(contact => {
      const name = contact.name.toLowerCase();
      const email = contact.email?.toLowerCase() ?? "";
      const phone = contact.phone ? normalizePhone(contact.phone) : "";
      const group = contact.group?.toLowerCase() ?? "";

      let score = 0;
      if (name === normalized || email === normalized) score = 30;
      else if (queryPhone && phone === queryPhone) score = 30;
      else if (name.startsWith(normalized) || email.startsWith(normalized)) score = 20;
      else if (queryPhone && phone.startsWith(queryPhone)) score = 20;
      else if (
        name.includes(normalized) ||
        email.includes(normalized) ||
        (queryPhone && phone.includes(queryPhone)) ||
        group.includes(normalized)
      ) {
        score = 10;
      }

      return { contact, score };
    })
    .filter(match => match.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score || a.contact.name.localeCompare(b.contact.name)
    );

  const topScore = matches[0]?.score ?? 0;
  const topMatches = matches.filter(match => match.score === topScore);

  return {
    matches,
    ambiguous: topMatches.length > 1 || (matches.length > 1 && topScore < 30),
  };
}

export interface ClassEnd {
  id: string;
  title: string;
  endAt: Date;
}

/** First non-all-day class that has not ended yet. */
export function nextClassEnd(
  entries: readonly {
    id: string;
    title: string;
    startAt: Date;
    endAt: Date | null;
    allDay: boolean;
  }[],
  now: Date
): ClassEnd | null {
  const upcoming = entries
    .filter(entry => !entry.allDay)
    .map(entry => ({
      id: entry.id,
      title: entry.title,
      endAt:
        entry.endAt ??
        new Date(entry.startAt.getTime() + 60 * 60_000),
    }))
    .filter(entry => entry.endAt.getTime() > now.getTime())
    .sort((a, b) => a.endAt.getTime() - b.endAt.getTime());

  return upcoming[0] ?? null;
}
