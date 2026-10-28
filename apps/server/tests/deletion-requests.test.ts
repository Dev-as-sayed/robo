import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  accountDeletionRequest: {
    upsert: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));
const deleteAccountData = vi.hoisted(() => vi.fn());

vi.mock("@robo/shared/lib/prisma", () => ({ prisma: db }));
vi.mock("../src/modules/users/account-deletion", () => ({ deleteAccountData }));

const {
  createDeletionRequest,
  listDeletionRequests,
  processDeletionRequest,
} = await import("../src/modules/users/deletion-requests");

const request = {
  id: "request-1",
  email: "student@example.com",
  userId: "user-1",
  reason: null,
  status: "PENDING" as const,
  note: null,
  requestedAt: new Date("2026-10-28T10:00:00Z"),
  processedAt: null,
  updatedAt: new Date("2026-10-28T10:00:00Z"),
};

describe("account deletion requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.user.findUnique.mockResolvedValue({ id: "user-1" });
    db.accountDeletionRequest.upsert.mockResolvedValue(request);
    db.accountDeletionRequest.findMany.mockResolvedValue([request]);
    db.accountDeletionRequest.findUnique.mockResolvedValue({
      id: "request-1",
      email: "student@example.com",
      status: "PENDING",
    });
    db.accountDeletionRequest.update.mockResolvedValue(request);
    deleteAccountData.mockResolvedValue({
      deleted: true,
      filesRemoved: 2,
      vectorsRemoved: true,
    });
  });

  it("creates a pending request for an existing account", async () => {
    const result = await createDeletionRequest({
      email: "student@example.com",
      reason: "Leaving",
      confirm: true,
    });

    expect(result).toEqual(request);
    expect(db.accountDeletionRequest.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: "student@example.com" },
        create: expect.objectContaining({ userId: "user-1" }),
        update: expect.objectContaining({ status: "PENDING" }),
      })
    );
  });

  it("does not store a request when no account matches", async () => {
    db.user.findUnique.mockResolvedValue(null);

    const result = await createDeletionRequest({
      email: "missing@example.com",
      confirm: true,
    });

    expect(result).toBeNull();
    expect(db.accountDeletionRequest.upsert).not.toHaveBeenCalled();
  });

  it("lists pending requests in newest-first order", async () => {
    const result = await listDeletionRequests({ status: "PENDING", limit: 10 });

    expect(result).toEqual([request]);
    expect(db.accountDeletionRequest.findMany).toHaveBeenCalledWith({
      where: { status: "PENDING" },
      orderBy: { requestedAt: "desc" },
      take: 10,
      select: expect.any(Object),
    });
  });

  it("dismisses a request without deleting the account", async () => {
    const result = await processDeletionRequest("request-1", {
      status: "DISMISSED",
      note: "Could not verify ownership",
    });

    expect(result.deleted).toBe(false);
    expect(deleteAccountData).not.toHaveBeenCalled();
    expect(db.accountDeletionRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "DISMISSED",
          note: "Could not verify ownership",
        }),
      })
    );
  });

  it("deletes the matching account after verification", async () => {
    const result = await processDeletionRequest("request-1", {
      status: "COMPLETED",
    });

    expect(result).toEqual({
      deleted: true,
      filesRemoved: 2,
      vectorsRemoved: true,
    });
    expect(db.user.findUnique).toHaveBeenCalledWith({
      where: { email: "student@example.com" },
      select: { id: true },
    });
    expect(deleteAccountData).toHaveBeenCalledWith("user-1");
  });

  it("completes a request when the account is already gone", async () => {
    db.user.findUnique.mockResolvedValue(null);

    const result = await processDeletionRequest("request-1", {
      status: "COMPLETED",
    });

    expect(result.deleted).toBe(false);
    expect(deleteAccountData).not.toHaveBeenCalled();
    expect(db.accountDeletionRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "COMPLETED",
          note: "No matching account",
        }),
      })
    );
  });

  it("rejects an already processed request", async () => {
    db.accountDeletionRequest.findUnique.mockResolvedValue({
      id: "request-1",
      email: "student@example.com",
      status: "DISMISSED",
    });

    await expect(
      processDeletionRequest("request-1", { status: "COMPLETED" })
    ).rejects.toMatchObject({ code: "DELETION_REQUEST_ALREADY_PROCESSED" });
  });

  it("rejects an unknown request", async () => {
    db.accountDeletionRequest.findUnique.mockResolvedValue(null);

    await expect(
      processDeletionRequest("request-2", { status: "COMPLETED" })
    ).rejects.toMatchObject({ code: "DELETION_REQUEST_NOT_FOUND" });
  });
});
