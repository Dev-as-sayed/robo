import type {
  AiFeedbackReason,
  AiFeedbackStatus,
  AiFeedbackSurface,
} from "@prisma/client";
import { prisma } from "@robo/shared/lib/prisma";
import type {
  AiFeedbackInput,
  AiFeedbackQueryInput,
  UpdateAiFeedbackInput,
} from "@robo/shared/schemas";
import { BadRequestError, NotFoundError } from "../../errors/app-error";

interface AiFeedbackResult {
  id: string;
  surface: AiFeedbackSurface;
  reason: AiFeedbackReason;
  status: AiFeedbackStatus;
  createdAt: Date;
}

interface AiFeedbackReview extends AiFeedbackResult {
  messageId: string | null;
  responseText: string | null;
  details: string | null;
  user: { id: string; name: string | null; email: string };
}

const reviewSelect = {
  id: true,
  surface: true,
  reason: true,
  status: true,
  messageId: true,
  responseText: true,
  details: true,
  createdAt: true,
  user: { select: { id: true, name: true, email: true } },
} as const;

const feedbackSelect = {
  id: true,
  surface: true,
  reason: true,
  status: true,
  createdAt: true,
} as const;

export async function createAiFeedback(
  userId: string,
  input: AiFeedbackInput
): Promise<AiFeedbackResult> {
  if (input.surface === "CHAT") {
    if (!input.messageId) {
      throw new BadRequestError(
        "A chat report needs the assistant message ID",
        "AI_FEEDBACK_MESSAGE_REQUIRED"
      );
    }

    const message = await prisma.message.findFirst({
      where: {
        id: input.messageId,
        role: "ASSISTANT",
        conversation: { userId },
      },
      select: { id: true },
    });

    if (!message) {
      throw new NotFoundError(
        "AI answer not found",
        "AI_FEEDBACK_MESSAGE_NOT_FOUND"
      );
    }

    const existing = await prisma.aiFeedback.findFirst({
      where: { userId, messageId: message.id },
      select: { id: true },
    });

    if (existing) {
      return prisma.aiFeedback.update({
        where: { id: existing.id },
        data: {
          reason: input.reason,
          details: input.details ?? null,
          status: "OPEN",
        },
        select: feedbackSelect,
      });
    }

    return prisma.aiFeedback.create({
      data: {
        userId,
        surface: "CHAT",
        messageId: message.id,
        reason: input.reason,
        details: input.details ?? null,
      },
      select: feedbackSelect,
    });
  }

  if (!input.responseText) {
    throw new BadRequestError(
      "A vision report needs the answer text",
      "AI_FEEDBACK_RESPONSE_REQUIRED"
    );
  }

  return prisma.aiFeedback.create({
    data: {
      userId,
      surface: "VISION",
      responseText: input.responseText,
      reason: input.reason,
      details: input.details ?? null,
    },
    select: feedbackSelect,
  });
}

export async function listAiFeedback(
  query: AiFeedbackQueryInput
): Promise<AiFeedbackReview[]> {
  return prisma.aiFeedback.findMany({
    where: query.status ? { status: query.status } : {},
    orderBy: { createdAt: "desc" },
    take: query.limit,
    select: reviewSelect,
  });
}

export async function reviewAiFeedback(
  id: string,
  input: UpdateAiFeedbackInput
): Promise<AiFeedbackReview> {
  const existing = await prisma.aiFeedback.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    throw new NotFoundError("AI feedback not found", "AI_FEEDBACK_NOT_FOUND");
  }

  return prisma.aiFeedback.update({
    where: { id },
    data: { status: input.status },
    select: reviewSelect,
  });
}
