import { describe, expect, it, vi } from "vitest";
import { HybridRateLimitStore } from "../src/lib/rate-limit-store";

const OPTIONS = { windowMs: 60_000 } as never;

describe("HybridRateLimitStore", () => {
  it("counts requests in memory without Redis", async () => {
    const store = new HybridRateLimitStore({ prefix: "test:" });
    store.init(OPTIONS);

    const first = await store.increment("127.0.0.1");
    const second = await store.increment("127.0.0.1");

    expect(first.totalHits).toBe(1);
    expect(second.totalHits).toBe(2);

    await store.resetKey("127.0.0.1");
    expect((await store.increment("127.0.0.1")).totalHits).toBe(1);
  });

  it("uses Redis counters and sets the expiry on the first hit", async () => {
    const redis = {
      incr: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2),
      pExpire: vi.fn().mockResolvedValue(true),
      decr: vi.fn().mockResolvedValue(1),
      del: vi.fn().mockResolvedValue(1),
    };
    const store = new HybridRateLimitStore({
      url: "redis://example",
      prefix: "test:",
      connect: async () => redis,
    });
    store.init(OPTIONS);

    await expect(store.increment("client")).resolves.toMatchObject({
      totalHits: 1,
    });
    await store.increment("client");

    expect(redis.incr).toHaveBeenCalledWith("test:client");
    expect(redis.pExpire).toHaveBeenCalledWith("test:client", 60_000);

    await store.decrement("client");
    await store.resetKey("client");
    expect(redis.decr).toHaveBeenCalledWith("test:client");
    expect(redis.del).toHaveBeenCalledWith("test:client");
  });

  it("falls back to memory when Redis is unavailable", async () => {
    const store = new HybridRateLimitStore({
      url: "redis://down",
      prefix: "test:",
      connect: async () => {
        throw new Error("connection refused");
      },
    });
    store.init(OPTIONS);

    await expect(store.increment("client")).resolves.toMatchObject({
      totalHits: 1,
    });
    await expect(store.increment("client")).resolves.toMatchObject({
      totalHits: 2,
    });
  });

  it("falls back after a Redis command fails", async () => {
    const redis = {
      incr: vi.fn().mockRejectedValue(new Error("READONLY")),
      pExpire: vi.fn(),
      decr: vi.fn(),
      del: vi.fn(),
    };
    const store = new HybridRateLimitStore({
      url: "redis://example",
      prefix: "test:",
      connect: async () => redis,
    });
    store.init(OPTIONS);

    await expect(store.increment("client")).resolves.toMatchObject({
      totalHits: 1,
    });
    await expect(store.increment("client")).resolves.toMatchObject({
      totalHits: 2,
    });
  });
});
