import { describe, expect, it, vi } from "vitest";
import {
  consumeAiQuota,
  getAiUsage,
  recordAiTokenUsage,
  startOfUtcDay,
} from "@robo/shared/ai-usage";

function store() {
  return {
    aiUsage: {
      upsert: vi.fn(async ({ create, update }: any) => ({
        requests:
          (create.requests ?? 0) +
          (typeof update?.requests?.increment === "number"
            ? update.requests.increment
            : 0),
      })),
      findUnique: vi.fn(),
    },
  } as any;
}

describe("AI usage", () => {
  it("normalises the quota day to UTC midnight", () => {
    expect(startOfUtcDay(new Date("2026-10-24T23:59:59Z")).toISOString()).toBe(
      "2026-10-24T00:00:00.000Z"
    );
  });

  it("allows requests up to the daily limit then blocks", async () => {
    const db = store();
    db.aiUsage.upsert
      .mockResolvedValueOnce({ requests: 1 })
      .mockResolvedValueOnce({ requests: 4 });

    await expect(
      consumeAiQuota("user-1", 3, new Date("2026-10-24T10:00:00Z"), db)
    ).resolves.toMatchObject({ allowed: true, remaining: 2 });
    await expect(
      consumeAiQuota("user-1", 3, new Date("2026-10-24T11:00:00Z"), db)
    ).resolves.toMatchObject({ allowed: false, used: 4, remaining: 0 });
  });

  it("records input and output token counters", async () => {
    const db = store();

    await recordAiTokenUsage(
      "user-1",
      { input_tokens: 120, output_tokens: 45 },
      new Date("2026-10-24T10:00:00Z"),
      db
    );

    expect(db.aiUsage.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          inputTokens: { increment: 120 },
          outputTokens: { increment: 45 },
        },
      })
    );
  });

  it("skips writes when no token metadata is present", async () => {
    const db = store();
    await recordAiTokenUsage("user-1", undefined, new Date(), db);
    expect(db.aiUsage.upsert).not.toHaveBeenCalled();
  });

  it("returns a zero snapshot for a fresh day", async () => {
    const db = store();
    db.aiUsage.findUnique.mockResolvedValue(null);
    await expect(getAiUsage("user-1", new Date(), db)).resolves.toEqual({
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
    });
  });
});
