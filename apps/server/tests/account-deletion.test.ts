import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  document: { findMany: vi.fn() },
}));
const deleteMe = vi.hoisted(() => vi.fn());
const deleteUserChunks = vi.hoisted(() => vi.fn());
const isRagConfigured = vi.hoisted(() => vi.fn());
const unlink = vi.hoisted(() => vi.fn());
const deleteStorageObject = vi.hoisted(() => vi.fn());
const isStorageConfigured = vi.hoisted(() => vi.fn());

vi.mock("@robo/shared/lib/prisma", () => ({ prisma: db }));
vi.mock("@robo/shared/users", () => ({ deleteMe }));
vi.mock("../src/modules/ai/qdrant", () => ({
  deleteUserChunks,
  isRagConfigured,
}));
vi.mock("../src/lib/storage", () => ({
  deleteStorageObject,
  isStorageConfigured,
}));
vi.mock("node:fs", () => ({ promises: { unlink } }));

const { deleteAccountData } = await import(
  "../src/modules/users/account-deletion"
);

describe("deleteAccountData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.document.findMany.mockResolvedValue([
      { filename: "upload-1", s3Key: null },
      { filename: "upload-2", s3Key: null },
    ]);
    deleteMe.mockResolvedValue({ deleted: true });
    deleteUserChunks.mockResolvedValue(undefined);
    unlink.mockResolvedValue(undefined);
    isRagConfigured.mockReturnValue(true);
    isStorageConfigured.mockReturnValue(false);
    deleteStorageObject.mockResolvedValue(undefined);
  });

  it("removes vectors, temp files and the database row", async () => {
    await expect(deleteAccountData("user-1")).resolves.toEqual({
      deleted: true,
      filesRemoved: 2,
      vectorsRemoved: true,
    });

    expect(deleteUserChunks).toHaveBeenCalledWith("user-1");
    expect(unlink).toHaveBeenCalledWith("/tmp/uploads/upload-1");
    expect(unlink).toHaveBeenCalledWith("/tmp/uploads/upload-2");
    expect(deleteMe).toHaveBeenCalledWith("user-1");
  });

  it("still deletes the account when a temp file is already gone", async () => {
    unlink.mockRejectedValue(new Error("ENOENT"));

    const result = await deleteAccountData("user-1");

    expect(result.filesRemoved).toBe(0);
    expect(deleteMe).toHaveBeenCalledWith("user-1");
  });

  it("does not touch vectors when RAG is not configured", async () => {
    isRagConfigured.mockReturnValue(false);

    const result = await deleteAccountData("user-1");

    expect(deleteUserChunks).not.toHaveBeenCalled();
    expect(result.vectorsRemoved).toBe(false);
  });

  it("deletes stored objects when object storage is configured", async () => {
    isStorageConfigured.mockReturnValue(true);
    db.document.findMany.mockResolvedValue([
      { filename: "upload-1", s3Key: "documents/user-1/one.pdf" },
      { filename: "upload-2", s3Key: "documents/user-1/two.pdf" },
    ]);

    const result = await deleteAccountData("user-1");

    expect(deleteStorageObject).toHaveBeenCalledWith("documents/user-1/one.pdf");
    expect(deleteStorageObject).toHaveBeenCalledWith("documents/user-1/two.pdf");
    expect(result.filesRemoved).toBe(4);
  });

  it("still deletes the account when a stored object cannot be removed", async () => {
    isStorageConfigured.mockReturnValue(true);
    deleteStorageObject.mockRejectedValue(new Error("storage down"));
    db.document.findMany.mockResolvedValue([
      { filename: "upload-1", s3Key: "documents/user-1/one.pdf" },
    ]);

    const result = await deleteAccountData("user-1");

    expect(deleteMe).toHaveBeenCalledWith("user-1");
    expect(result.filesRemoved).toBe(1);
  });
});
