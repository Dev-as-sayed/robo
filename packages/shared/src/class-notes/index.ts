import { prisma } from "../lib/prisma";

export interface ClassNoteFilters {
  subject?: string;
  search?: string;
  from?: string;
  to?: string;
  limit?: number;
}

const select = {
  id: true,
  userId: true,
  scheduleEntryId: true,
  subject: true,
  title: true,
  content: true,
  classAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function createClassNote(
  userId: string,
  data: {
    title?: string;
    subject?: string;
    content: string;
    classAt?: Date;
    scheduleEntryId?: string;
  }
) {
  const content = data.content.trim();
  if (!content) throw new Error("CLASS_NOTE_CONTENT_REQUIRED");
  if (content.length > 10000) throw new Error("CLASS_NOTE_TOO_LONG");

  let title = data.title?.trim();
  let subject = data.subject?.trim();
  let classAt = data.classAt;

  if (data.scheduleEntryId) {
    const entry = await prisma.scheduleEntry.findFirst({
      where: { id: data.scheduleEntryId, userId },
      select: { title: true, subject: true, startAt: true },
    });
    if (!entry) throw new Error("CLASS_NOTE_SCHEDULE_NOT_FOUND");

    title = title || entry.title;
    subject = subject || entry.subject || undefined;
    classAt = classAt ?? entry.startAt;
  }

  if (!title) throw new Error("CLASS_NOTE_TITLE_REQUIRED");

  return prisma.classNote.create({
    data: {
      userId,
      scheduleEntryId: data.scheduleEntryId,
      title,
      subject,
      content,
      classAt: classAt ?? new Date(),
    },
    select,
  });
}

export async function getClassNotes(userId: string, filters: ClassNoteFilters = {}) {
  const search = filters.search?.trim();

  return prisma.classNote.findMany({
    where: {
      userId,
      ...(filters.subject ? { subject: filters.subject } : {}),
      ...(filters.from || filters.to
        ? {
            classAt: {
              ...(filters.from ? { gte: new Date(filters.from) } : {}),
              ...(filters.to ? { lte: new Date(filters.to) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" as const } },
              { content: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { classAt: "desc" },
    take: Math.min(100, Math.max(1, filters.limit ?? 50)),
    select,
  });
}

export async function getClassNote(userId: string, noteId: string) {
  const note = await prisma.classNote.findFirst({
    where: { id: noteId, userId },
    select,
  });
  if (!note) throw new Error("CLASS_NOTE_NOT_FOUND");
  return note;
}

export async function updateClassNote(
  userId: string,
  noteId: string,
  data: { title?: string; subject?: string; content?: string; classAt?: Date }
) {
  await getClassNote(userId, noteId);

  const patch: {
    title?: string;
    subject?: string;
    content?: string;
    classAt?: Date;
  } = {};

  if (data.title !== undefined) {
    const title = data.title.trim();
    if (!title) throw new Error("CLASS_NOTE_TITLE_REQUIRED");
    patch.title = title;
  }
  if (data.subject !== undefined) patch.subject = data.subject.trim() || undefined;
  if (data.content !== undefined) {
    const content = data.content.trim();
    if (!content) throw new Error("CLASS_NOTE_CONTENT_REQUIRED");
    if (content.length > 10000) throw new Error("CLASS_NOTE_TOO_LONG");
    patch.content = content;
  }
  if (data.classAt !== undefined) patch.classAt = data.classAt;

  return prisma.classNote.update({
    where: { id: noteId, userId },
    data: patch,
    select,
  });
}

export async function deleteClassNote(userId: string, noteId: string): Promise<void> {
  await prisma.classNote.delete({ where: { id: noteId, userId } });
}

export interface DueClassNotePrompt {
  id: string;
  userId: string;
  title: string;
  subject: string | null;
  endedAt: Date;
  dueAt: Date;
  firedAt: Date;
}

/** Classes that ended 5–35 minutes ago and have no note or prior prompt. */
export async function claimDueClassNotePrompts(
  now: Date,
  limit = 50
): Promise<DueClassNotePrompt[]> {
  const from = new Date(now.getTime() - 35 * 60_000);
  const to = new Date(now.getTime() - 5 * 60_000);

  const candidates = await prisma.scheduleEntry.findMany({
    where: {
      allDay: false,
      endAt: { gte: from, lte: to },
      notePromptedAt: null,
      notes: { none: {} },
    },
    orderBy: { endAt: "asc" },
    take: limit,
    select: {
      id: true,
      userId: true,
      title: true,
      subject: true,
      endAt: true,
    },
  });

  const claimed: DueClassNotePrompt[] = [];

  for (const candidate of candidates) {
    if (!candidate.endAt) continue;

    const updated = await prisma.scheduleEntry.updateMany({
      where: { id: candidate.id, notePromptedAt: null },
      data: { notePromptedAt: now },
    });
    if (updated.count !== 1) continue;

    claimed.push({
      id: candidate.id,
      userId: candidate.userId,
      title: candidate.title,
      subject: candidate.subject,
      endedAt: candidate.endAt,
      dueAt: new Date(candidate.endAt.getTime() + 5 * 60_000),
      firedAt: now,
    });
  }

  return claimed;
}
