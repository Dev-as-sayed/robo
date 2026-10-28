import type { DeletionRequestStatus } from "@prisma/client";
import { prisma } from "@robo/shared/lib/prisma";
import type {
  AccountDeletionRequestInput,
  AdminDeletionRequestQueryInput,
  UpdateDeletionRequestInput,
} from "@robo/shared/schemas";
import { BadRequestError, NotFoundError } from "../../errors/app-error";
import { deleteAccountData } from "./account-deletion";

export interface DeletionRequestSummary {
  id: string;
  email: string;
  userId: string | null;
  reason: string | null;
  status: DeletionRequestStatus;
  note: string | null;
  requestedAt: Date;
  processedAt: Date | null;
  updatedAt: Date;
}

export interface ProcessDeletionRequestResult {
  deleted: boolean;
  filesRemoved?: number;
  vectorsRemoved?: boolean;
  request?: DeletionRequestSummary;
}

const requestSelect = {
  id: true,
  email: true,
  userId: true,
  reason: true,
  status: true,
  note: true,
  requestedAt: true,
  processedAt: true,
  updatedAt: true,
} as const;

export async function createDeletionRequest(
  input: AccountDeletionRequestInput
): Promise<DeletionRequestSummary | null> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  if (!user) {
    return null;
  }

  return prisma.accountDeletionRequest.upsert({
    where: { email: input.email },
    create: {
      email: input.email,
      userId: user?.id ?? null,
      reason: input.reason ?? null,
    },
    update: {
      userId: user?.id ?? null,
      reason: input.reason ?? null,
      status: "PENDING",
      note: null,
      processedAt: null,
      requestedAt: new Date(),
    },
    select: requestSelect,
  });
}

export async function listDeletionRequests(
  query: AdminDeletionRequestQueryInput
): Promise<DeletionRequestSummary[]> {
  return prisma.accountDeletionRequest.findMany({
    where: query.status ? { status: query.status } : {},
    orderBy: { requestedAt: "desc" },
    take: query.limit,
    select: requestSelect,
  });
}

export async function processDeletionRequest(
  id: string,
  input: UpdateDeletionRequestInput
): Promise<ProcessDeletionRequestResult> {
  const request = await prisma.accountDeletionRequest.findUnique({
    where: { id },
    select: { id: true, email: true, status: true },
  });

  if (!request) {
    throw new NotFoundError(
      "Deletion request not found",
      "DELETION_REQUEST_NOT_FOUND"
    );
  }

  if (request.status !== "PENDING") {
    throw new BadRequestError(
      "This deletion request was already processed",
      "DELETION_REQUEST_ALREADY_PROCESSED"
    );
  }

  const processedAt = new Date();

  if (input.status === "DISMISSED") {
    const updated = await prisma.accountDeletionRequest.update({
      where: { id },
      data: {
        status: "DISMISSED",
        note: input.note ?? null,
        processedAt,
      },
      select: requestSelect,
    });

    return { deleted: false, request: updated };
  }

  const user = await prisma.user.findUnique({
    where: { email: request.email },
    select: { id: true },
  });

  if (!user) {
    const updated = await prisma.accountDeletionRequest.update({
      where: { id },
      data: {
        status: "COMPLETED",
        note: input.note ?? "No matching account",
        processedAt,
      },
      select: requestSelect,
    });

    return { deleted: false, request: updated };
  }

  const result = await deleteAccountData(user.id);

  return {
    deleted: result.deleted,
    filesRemoved: result.filesRemoved,
    vectorsRemoved: result.vectorsRemoved,
  };
}
