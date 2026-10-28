import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("embedding benchmark fixture", () => {
  it("has enough labelled documents and queries", async () => {
    const fixture = JSON.parse(
      await readFile(path.join(__dirname, "fixtures/embedding-benchmark.json"), "utf8")
    ) as {
      documents: Array<{ id: string; text: string }>;
      queries: Array<{ id: string; expectedDocumentId: string; expectedTerms: string[] }>;
    };

    const documentIds = new Set(fixture.documents.map((document) => document.id));
    expect(fixture.documents.length).toBeGreaterThanOrEqual(20);
    expect(fixture.queries.length).toBeGreaterThanOrEqual(10);

    for (const query of fixture.queries) {
      expect(documentIds.has(query.expectedDocumentId)).toBe(true);
      expect(query.expectedTerms.length).toBeGreaterThan(0);
    }
  });
});
