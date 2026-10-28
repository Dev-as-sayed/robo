import { beforeEach, describe, expect, it, vi } from "vitest";
import { aiFeedbackSchema } from "@robo/shared/schemas";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    message: {
      findFirst: vi.fn(),
    },
    aiFeedback: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@robo/shared/lib/prisma", () => ({ prisma: prismaMock }));

import {
  createAiFeedback,
  listAiFeedback,
  reviewAiFeedback,
} from "../src/modules/chat/feedback";

const feedback = {
  id: "feedback-1",
  surface: "CHAT",
  reason: "OFFENSIVE",
  status: "OPEN",
  createdAt: new Date(0),
};

describe("aiFeedbackSchema", () => {
  it("accepts a chat report with a message id", () => {
    const parsed = aiFeedbackSchema.parse({
      surface: "CHAT",
      messageId: "8c2f0f6e-6e2f-4f7e-9d1a-0c3a5e7f9b1d",
      reason: "OFFENSIVE",
    });

    expect(parsed.messageId).toBe("8c2f0f6e-6e2f-4f7e-9d1a-0c3a5e7f9b1d");
  });

  it("accepts a vision report with answer text", () => {
    expect(
      aiFeedbackSchema.parse({
        surface: "VISION",
        responseText: "The derivative is 2x.",
        reason: "INCORRECT",
      }).responseText
    ).toBe("The derivative is 2x.");
  });

  it("requires a message id for chat reports", () => {
    expect(
      aiFeedbackSchema.safeParse({ surface: "CHAT", reason: "OTHER" }).success
    ).toBe(false);
  });

  it("requires answer text for vision reports", () => {
    expect(
      aiFeedbackSchema.safeParse({ surface: "VISION", reason: "OTHER" }).success
    ).toBe(false);
  });
});

describe("createAiFeedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records feedback only for an owned assistant message", async () => {
    prismaMock.message.findFirst.mockResolvedValue({ id: "message-1" });
    prismaMock.aiFeedback.findFirst.mockResolvedValue(null);
    prismaMock.aiFeedback.create.mockResolvedValue(feedback);

    const result = await createAiFeedback("user-1", {
      surface: "CHAT",
      messageId: "message-1",
      reason: "OFFENSIVE",
    });

    expect(result).toEqual(feedback);
    expect(prismaMock.message.findFirst).toHaveBeenCalledWith({
      where: {
        id: "message-1",
        role: "ASSISTANT",
        conversation: { userId: "user-1" },
      },
      select: { id: true },
    });
    expect(prismaMock.aiFeedback.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          surface: "CHAT",
          messageId: "message-1",
          reason: "OFFENSIVE",
        }),
      })
    );
  });

  it("reopens an existing report instead of creating a duplicate", async () => {
    prismaMock.message.findFirst.mockResolvedValue({ id: "message-1" });
    prismaMock.aiFeedback.findFirst.mockResolvedValue({ id: "feedback-1" });
    prismaMock.aiFeedback.update.mockResolvedValue({
      ...feedback,
      reason: "INCORRECT",
    });

    const result = await createAiFeedback("user-1", {
      surface: "CHAT",
      messageId: "message-1",
      reason: "INCORRECT",
      details: "The formula is wrong.",
    });

    expect(result.reason).toBe("INCORRECT");
    expect(prismaMock.aiFeedback.update).toHaveBeenCalledWith({
      where: { id: "feedback-1" },
      data: {
        reason: "INCORRECT",
        details: "The formula is wrong.",
        status: "OPEN",
      },
      select: expect.any(Object),
    });
    expect(prismaMock.aiFeedback.create).not.toHaveBeenCalled();
  });

  it("rejects a message that the user does not own", async () => {
    prismaMock.message.findFirst.mockResolvedValue(null);

    await expect(
      createAiFeedback("user-1", {
        surface: "CHAT",
        messageId: "message-2",
        reason: "OTHER",
      })
    ).rejects.toMatchObject({ code: "AI_FEEDBACK_MESSAGE_NOT_FOUND" });
  });

  it("records a vision report without a stored message", async () => {
    prismaMock.aiFeedback.create.mockResolvedValue({
      ...feedback,
      surface: "VISION",
      reason: "INCORRECT",
    });

    const result = await createAiFeedback("user-1", {
      surface: "VISION",
      responseText: "The derivative is 2x.",
      reason: "INCORRECT",
    });

    expect(result.surface).toBe("VISION");
    expect(prismaMock.aiFeedback.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        surface: "VISION",
        responseText: "The derivative is 2x.",
        reason: "INCORRECT",
        details: null,
      },
      select: expect.any(Object),
    });
  });
});

describe("feedback review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists feedback with an optional open filter", async () => {
    prismaMock.aiFeedback.findMany.mockResolvedValue([
      {
        ...feedback,
        messageId: "message-1",
        responseText: null,
        details: null,
        user: { id: "user-1", name: "Sam", email: "sam@example.com" },
      },
    ]);

    const result = await listAiFeedback({ status: "OPEN", limit: 20 });

    expect(result).toHaveLength(1);
    expect(prismaMock.aiFeedback.findMany).toHaveBeenCalledWith({
      where: { status: "OPEN" },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: expect.any(Object),
    });
  });

  it("updates the review status of an existing report", async () => {
    prismaMock.aiFeedback.findUnique.mockResolvedValue({ id: "feedback-1" });
    prismaMock.aiFeedback.update.mockResolvedValue({
      ...feedback,
      status: "REVIEWED",
      messageId: "message-1",
      responseText: null,
      details: null,
      user: { id: "user-1", name: "Sam", email: "sam@example.com" },
    });

    const result = await reviewAiFeedback("feedback-1", {
      status: "REVIEWED",
    });

    expect(result.status).toBe("REVIEWED");
    expect(prismaMock.aiFeedback.update).toHaveBeenCalledWith({
      where: { id: "feedback-1" },
      data: { status: "REVIEWED" },
      select: expect.any(Object),
    });
  });

  it("rejects an unknown report", async () => {
    prismaMock.aiFeedback.findUnique.mockResolvedValue(null);

    await expect(
      reviewAiFeedback("feedback-2", { status: "DISMISSED" })
    ).rejects.toMatchObject({ code: "AI_FEEDBACK_NOT_FOUND" });
  });
});
