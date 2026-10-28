import type { ParsedPage } from "./parsers";

export interface DocumentChunk {
  page: number | null;
  text: string;
}

export interface ChunkOptions {
  maxChars: number;
  overlapChars: number;
}

function lastBoundary(text: string, from: number, to: number): number {
  const window = text.slice(from, to);
  const sentence = Math.max(
    window.lastIndexOf(". "),
    window.lastIndexOf("! "),
    window.lastIndexOf("? "),
    window.lastIndexOf(".\n"),
    window.lastIndexOf("!\n"),
    window.lastIndexOf("?\n")
  );
  if (sentence >= Math.floor(window.length * 0.5)) {
    return from + sentence + 1;
  }

  const newline = window.lastIndexOf("\n");
  if (newline >= Math.floor(window.length * 0.5)) {
    return from + newline;
  }

  const space = window.lastIndexOf(" ");
  return space > 0 ? from + space : to;
}

/**
 * Splits each parsed page into overlapping chunks without mixing pages, so every
 * chunk can carry a stable page/slide citation. Boundaries prefer sentence ends,
 * then paragraphs, then words.
 */
export function chunkPages(
  pages: readonly ParsedPage[],
  options: ChunkOptions
): DocumentChunk[] {
  const maxChars = Math.max(200, options.maxChars);
  const overlapChars = Math.min(
    Math.max(0, options.overlapChars),
    Math.floor(maxChars / 2)
  );
  const chunks: DocumentChunk[] = [];

  for (const page of pages) {
    const text = page.text.replace(/\s+/g, " ").trim();
    if (!text) {
      continue;
    }

    let start = 0;
    while (start < text.length) {
      const hardEnd = Math.min(start + maxChars, text.length);
      const end =
        hardEnd < text.length ? lastBoundary(text, start, hardEnd) : text.length;
      const chunk = text.slice(start, Math.max(end, start + 1)).trim();

      if (chunk) {
        chunks.push({ page: page.page, text: chunk });
      }

      if (end >= text.length) {
        break;
      }

      const nextStart = Math.max(end - overlapChars, start + 1);
      start = nextStart;
    }
  }

  return chunks;
}
