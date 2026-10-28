import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  classNote: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  scheduleEntry: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock("@robo/shared/lib/prisma", () => ({ prisma: db }));

const {
  claimDueClassNotePrompts,
  createClassNote,
  deleteClassNote,
  getClassNotes,
  updateClassNote,
} = await import("@robo/shared/class-notes");
const { ClassNoteScheduler } = await import(
  "../src/modules/class-notes/scheduler"
);

const now = new Date("2026-10-23T12:00:00.000Z");

function note(overrides: Record<string, unknown> = {}) {
  return {
    id: "note-1",
    userId: "user-1",
    scheduleEntryId: "class-1",
    subject: "Physics",
    title: "Optics",
    content: "Refraction recap",
    classAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("class notes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fills title, subject and time from a timetable entry", async () => {
    db.scheduleEntry.findFirst.mockResolvedValue({
      title: "Physics 101",
      subject: "Physics",
      startAt: now,
    });
    db.classNote.create.mockResolvedValue(
      note({ title: "Physics 101", scheduleEntryId: "class-1" })
    );

    await createClassNote("user-1", {
      content: "  Refraction recap  ",
      scheduleEntryId: "class-1",
    });

    expect(db.scheduleEntry.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "class-1", userId: "user-1" } })
    );
    expect(db.classNote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          scheduleEntryId: "class-1",
          title: "Physics 101",
          subject: "Physics",
          content: "Refraction recap",
          classAt: now,
        }),
      })
    );
  });

  it("rejects empty content and a class owned by another user", async () => {
    await expect(
      createClassNote("user-1", { content: "  ", title: "Optics" })
    ).rejects.toThrow("CLASS_NOTE_CONTENT_REQUIRED");

    db.scheduleEntry.findFirst.mockResolvedValue(null);
    await expect(
      createClassNote("user-1", { content: "Note", scheduleEntryId: "class-2" })
    ).rejects.toThrow("CLASS_NOTE_SCHEDULE_NOT_FOUND");
  });

  it("searches title and content within one user", async () => {
    db.classNote.findMany.mockResolvedValue([note()]);

    await getClassNotes("user-1", {
      subject: "Physics",
      search: "refraction",
      from: "2026-10-01T00:00:00.000Z",
      to: "2026-10-31T00:00:00.000Z",
      limit: 500,
    });

    expect(db.classNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          subject: "Physics",
          classAt: {
            gte: new Date("2026-10-01T00:00:00.000Z"),
            lte: new Date("2026-10-31T00:00:00.000Z"),
          },
          OR: [
            { title: { contains: "refraction", mode: "insensitive" } },
            { content: { contains: "refraction", mode: "insensitive" } },
          ],
        }),
        take: 100,
      })
    );
  });

  it("updates and deletes with ownership", async () => {
    db.classNote.findFirst.mockResolvedValue(note());
    db.classNote.update.mockResolvedValue(note({ content: "Updated" }));

    await updateClassNote("user-1", "note-1", { content: " Updated " });

    expect(db.classNote.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "note-1", userId: "user-1" },
        data: { content: "Updated" },
      })
    );
    expect(db.classNote.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "note-1", userId: "user-1" } })
    );

    await deleteClassNote("user-1", "note-1");
    expect(db.classNote.delete).toHaveBeenCalledWith({
      where: { id: "note-1", userId: "user-1" },
    });
  });

  it("claims classes that ended 5 to 35 minutes ago", async () => {
    db.scheduleEntry.findMany.mockResolvedValue([
      {
        id: "class-1",
        userId: "user-1",
        title: "Physics 101",
        subject: "Physics",
        endAt: new Date(now.getTime() - 10 * 60_000),
      },
    ]);
    db.scheduleEntry.updateMany.mockResolvedValue({ count: 1 });

    const due = await claimDueClassNotePrompts(now);

    expect(db.scheduleEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          endAt: {
            gte: new Date(now.getTime() - 35 * 60_000),
            lte: new Date(now.getTime() - 5 * 60_000),
          },
          notePromptedAt: null,
          notes: { none: {} },
        }),
      })
    );
    expect(due).toHaveLength(1);
    expect(due[0]?.dueAt).toEqual(
      new Date(now.getTime() - 5 * 60_000)
    );
    expect(db.scheduleEntry.updateMany).toHaveBeenCalledWith({
      where: { id: "class-1", notePromptedAt: null },
      data: { notePromptedAt: now },
    });
  });

  it("skips a prompt another worker already claimed", async () => {
    db.scheduleEntry.findMany.mockResolvedValue([
      {
        id: "class-1",
        userId: "user-1",
        title: "Physics 101",
        subject: "Physics",
        endAt: new Date(now.getTime() - 10 * 60_000),
      },
    ]);
    db.scheduleEntry.updateMany.mockResolvedValue({ count: 0 });

    await expect(claimDueClassNotePrompts(now)).resolves.toEqual([]);
  });

  it("scheduler delivers claimed prompts", async () => {
    const deliver = vi.fn().mockResolvedValue(true);
    const claim = vi.fn().mockResolvedValue([
      {
        id: "class-1",
        userId: "user-1",
        title: "Physics 101",
        subject: "Physics",
        endedAt: now,
        dueAt: now,
        firedAt: now,
      },
    ]);
    const scheduler = new ClassNoteScheduler({
      deliver,
      claim,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      } as never,
    });

    await expect(scheduler.tick(now)).resolves.toBe(1);
    expect(deliver).toHaveBeenCalledTimes(1);
  });
});
