import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildTools } from "../src/modules/ai/tools";

interface RegressionCase {
  id: string;
  utterance: string;
  expectedTool?: string;
  expectedArgs?: Record<string, unknown>;
  expectNoTools?: boolean;
}

const fixture = JSON.parse(
  readFileSync(
    path.join(__dirname, "fixtures/ai-regression.json"),
    "utf8"
  )
) as RegressionCase[];

const toolNames = new Set(
  buildTools({
    userId: "test-user",
    conversationId: "test",
    timezone: "UTC",
    locale: "en",
    now: new Date(),
  }).map(tool => tool.name)
);

describe("AI regression fixture", () => {
  it("has at least 50 unique cases with utterances", () => {
    expect(fixture.length).toBeGreaterThanOrEqual(50);
    expect(new Set(fixture.map(item => item.id)).size).toBe(fixture.length);
    for (const item of fixture) {
      expect(item.utterance.trim().length).toBeGreaterThan(3);
      expect(Boolean(item.expectedTool) || Boolean(item.expectNoTools)).toBe(true);
    }
  });

  it("references only tools that exist", () => {
    const unknown = fixture
      .filter(item => item.expectedTool && !toolNames.has(item.expectedTool))
      .map(item => `${item.id}:${item.expectedTool}`);
    expect(unknown).toEqual([]);
  });

  it("covers refusals and parameter checks", () => {
    expect(fixture.filter(item => item.expectNoTools).length).toBeGreaterThanOrEqual(5);
    expect(fixture.filter(item => item.expectedArgs).length).toBeGreaterThanOrEqual(5);
  });
});
