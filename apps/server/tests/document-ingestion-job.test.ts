import type { Document } from "@robo/shared/documents";
import { describe, expect, it, vi } from "vitest";
import { DocumentIngestionJob } from "../src/modules/documents/ingestion-job";

function document(attempts = 1): Document {
  return {
    id: "doc-1",
    userId: "user-1",
    filename: "notes.txt",
    originalName: "notes.txt",
    size: 10,
    mimeType: "text/plain",
    s3Key: "key",
    s3Url: null,
    status: "parsing",
    subject: null,
    checksum: null,
    pageCount: null,
    chunkCount: 0,
    attempts,
    error: null,
    embeddingModel: null,
    lockedAt: null,
    nextAttemptAt: null,
    indexedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function job(overrides: Record<string, unknown> = {}) {
  const claim = vi.fn();
  const run = vi.fn().mockResolvedValue({ pageCount: 1, chunkCount: 3, usedOcr: false });
  const fail = vi.fn().mockResolvedValue("retry");
  const reindex = vi.fn().mockResolvedValue(0);

  const instance = new DocumentIngestionJob({
    embeddingModel: "bge-m3",
    intervalMs: 1_000,
    reindexIntervalMs: 60_000,
    claim,
    run,
    fail,
    reindex,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as never,
    ...overrides,
  });

  return { instance, claim, run, fail, reindex };
}

describe("document ingestion job", () => {
  it("claims and indexes one document per tick", async () => {
    const { instance, claim, run } = job();
    claim.mockResolvedValue(document());

    const summary = await instance.tick(new Date("2026-10-25T12:00:00Z"));

    expect(summary).toMatchObject({ claimed: 1, indexed: 1, failed: 0, retried: 0 });
    expect(run).toHaveBeenCalledOnce();
  });

  it("schedules a retry when ingestion fails", async () => {
    const { instance, claim, run, fail } = job();
    claim.mockResolvedValue(document());
    run.mockRejectedValue(new Error("boom"));

    const summary = await instance.tick(new Date("2026-10-25T12:00:00Z"));

    expect(summary.retried).toBe(1);
    expect(fail).toHaveBeenCalledWith(
      expect.objectContaining({ id: "doc-1" }),
      expect.any(Error),
      expect.objectContaining({ maxAttempts: 3 })
    );
  });

  it("counts permanent failures separately", async () => {
    const { instance, claim, run, fail } = job();
    claim.mockResolvedValue(document(3));
    run.mockRejectedValue(new Error("boom"));
    fail.mockResolvedValue("failed");

    const summary = await instance.tick(new Date("2026-10-25T12:00:00Z"));

    expect(summary.failed).toBe(1);
    expect(summary.retried).toBe(0);
  });

  it("does nothing when the queue is empty", async () => {
    const { instance, claim, run } = job();
    claim.mockResolvedValue(null);

    const summary = await instance.tick(new Date("2026-10-25T12:00:00Z"));

    expect(summary).toMatchObject({ claimed: 0, indexed: 0 });
    expect(run).not.toHaveBeenCalled();
  });

  it("runs the re-index scan only once per interval", async () => {
    const { instance, claim, reindex } = job();
    claim.mockResolvedValue(null);
    reindex.mockResolvedValue(2);

    await instance.tick(new Date("2026-10-25T12:00:00Z"));
    await instance.tick(new Date("2026-10-25T12:00:10Z"));
    await instance.tick(new Date("2026-10-25T12:02:00Z"));

    expect(reindex).toHaveBeenCalledTimes(2);
  });

  it("shares one tick when called concurrently", async () => {
    const { instance, claim } = job();
    claim.mockResolvedValue(document());

    const [first, second] = await Promise.all([
      instance.tick(new Date("2026-10-25T12:00:00Z")),
      instance.tick(new Date("2026-10-25T12:00:00Z")),
    ]);

    expect(first).toBe(second);
    expect(claim).toHaveBeenCalledOnce();
  });
});
