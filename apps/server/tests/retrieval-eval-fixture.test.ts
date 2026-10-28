import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

interface RetrievalCase {
  id: string;
  question: string;
  expectedSource: string;
  expectedTerms: string[];
}

describe("retrieval evaluation fixture", () => {
  it("contains at least 50 unique, well-formed questions", async () => {
    const fixture = JSON.parse(
      await readFile(path.join(__dirname, "fixtures/retrieval-eval.json"), "utf8")
    ) as { questions: RetrievalCase[] };

    expect(fixture.questions.length).toBeGreaterThanOrEqual(50);
    expect(new Set(fixture.questions.map((item) => item.id)).size).toBe(
      fixture.questions.length
    );

    for (const item of fixture.questions) {
      expect(item.question.length).toBeGreaterThan(8);
      expect(item.expectedSource).toMatch(/\.(pdf|docx|pptx|md|txt)$/);
      expect(item.expectedTerms.length).toBeGreaterThan(0);
    }
  });

  it("covers multiple source documents", async () => {
    const fixture = JSON.parse(
      await readFile(path.join(__dirname, "fixtures/retrieval-eval.json"), "utf8")
    ) as { questions: RetrievalCase[] };

    const sources = new Set(fixture.questions.map((item) => item.expectedSource));
    expect(sources.size).toBeGreaterThanOrEqual(5);
  });
});
