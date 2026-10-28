import { describe, expect, it } from "vitest";
import { chunkPages } from "../src/modules/documents/chunk";

describe("document chunking", () => {
  it("keeps page metadata and produces readable chunk sizes", () => {
    const page = "Sentence one is short. ".repeat(30).trim();
    const chunks = chunkPages([{ page: 7, text: page, ocr: false }], {
      maxChars: 200,
      overlapChars: 30,
    });

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.page).toBe(7);
      expect(chunk.text.length).toBeLessThanOrEqual(210);
      expect(chunk.text.length).toBeGreaterThan(0);
    }
  });

  it("overlaps chunks without restarting from the same offset", () => {
    const text = Array.from({ length: 60 }, (_, index) => `word${index}`).join(" ");
    const chunks = chunkPages([{ page: null, text, ocr: false }], {
      maxChars: 120,
      overlapChars: 20,
    });

    expect(chunks.length).toBeGreaterThan(2);
    const starts = chunks.map((chunk) => text.indexOf(chunk.text.slice(0, 12)));
    expect(new Set(starts).size).toBe(starts.length);
  });

  it("skips empty pages and trims whitespace", () => {
    const chunks = chunkPages(
      [
        { page: 1, text: "   \n\n ", ocr: false },
        { page: 2, text: "  Chapter two   text.  ", ocr: false },
      ],
      { maxChars: 400, overlapChars: 20 }
    );

    expect(chunks).toEqual([{ page: 2, text: "Chapter two text." }]);
  });

  it("hard-splits a single very long word", () => {
    const chunks = chunkPages(
      [{ page: 1, text: "a".repeat(700), ocr: false }],
      { maxChars: 200, overlapChars: 0 }
    );

    expect(chunks.length).toBeGreaterThan(3);
    expect(chunks.every((chunk) => chunk.text.length <= 200)).toBe(true);
  });

  it("clamps overlap so chunking always advances", () => {
    const chunks = chunkPages(
      [{ page: 1, text: "one two three four five six seven eight nine ten", ocr: false }],
      { maxChars: 200, overlapChars: 5_000 }
    );

    expect(chunks).toHaveLength(1);
  });
});
