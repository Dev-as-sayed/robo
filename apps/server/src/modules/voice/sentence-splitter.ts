const TERMINATORS = new Set([".", "!", "?"]);
const CLOSERS = "\"')]}";
const NEWLINE = "\n";
const MAX_SENTENCE_LENGTH = 240;

const ABBREVIATIONS = new Set([
  "mr.",
  "mrs.",
  "ms.",
  "dr.",
  "prof.",
  "sr.",
  "jr.",
  "st.",
  "vs.",
  "etc.",
  "e.g.",
  "i.e.",
  "no.",
]);

function isAbbreviation(sentence: string): boolean {
  return ABBREVIATIONS.has(sentence.toLowerCase());
}

function isDecimalPoint(text: string, index: number): boolean {
  if (text[index] !== ".") {
    return false;
  }

  const previous = text[index - 1] ?? "";
  const next = text[index + 1] ?? "";
  return /\d/.test(previous) && /\d/.test(next);
}

function splitLongSegment(segment: string): string[] {
  const parts: string[] = [];
  let remaining = segment;

  while (remaining.length > MAX_SENTENCE_LENGTH) {
    const window = remaining.slice(0, MAX_SENTENCE_LENGTH);
    const breakAt = Math.max(
      window.lastIndexOf(" "),
      window.lastIndexOf(","),
      window.lastIndexOf(";"),
      window.lastIndexOf(":")
    );

    if (breakAt <= 0) {
      break;
    }

    parts.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt + 1).trimStart();
  }

  if (remaining.length > 0) {
    parts.push(remaining);
  }

  return parts;
}

export class SentenceSplitter {
  private buffer = "";

  push(chunk: string): string[] {
    if (!chunk) {
      return [];
    }

    this.buffer += chunk;
    return this.drain(false);
  }

  flush(): string[] {
    const sentences = this.drain(true);
    const remainder = this.buffer.trim();

    if (remainder) {
      sentences.push(...splitLongSegment(remainder));
    }

    this.buffer = "";
    return sentences;
  }

  private drain(final: boolean): string[] {
    const sentences: string[] = [];
    let start = 0;
    let index = 0;

    while (index < this.buffer.length) {
      const character = this.buffer[index];

      if (character === NEWLINE) {
        const candidate = this.buffer.slice(start, index).trim();
        if (candidate) {
          sentences.push(...splitLongSegment(candidate));
        }
        start = index + 1;
        index += 1;
        continue;
      }

      if (!TERMINATORS.has(character) || isDecimalPoint(this.buffer, index)) {
        index += 1;
        continue;
      }

      let end = index + 1;
      while (end < this.buffer.length && CLOSERS.includes(this.buffer[end])) {
        end += 1;
      }

      if (end < this.buffer.length && !/\s/.test(this.buffer[end])) {
        index += 1;
        continue;
      }

      if (end === this.buffer.length && !final) {
        index += 1;
        continue;
      }

      const candidate = this.buffer.slice(start, end).trim();
      if (!candidate) {
        start = end;
        index = end;
        continue;
      }

      if (isAbbreviation(candidate)) {
        index = end;
        continue;
      }

      sentences.push(...splitLongSegment(candidate));
      start = end;
      index = end;
    }

    this.buffer = this.buffer.slice(start).trimStart();
    return sentences;
  }
}

export function splitSentences(text: string): string[] {
  const splitter = new SentenceSplitter();
  return [...splitter.push(text), ...splitter.flush()];
}

export async function* sentencesFromStream(
  chunks: AsyncIterable<string>
): AsyncGenerator<string> {
  const splitter = new SentenceSplitter();

  for await (const chunk of chunks) {
    for (const sentence of splitter.push(chunk)) {
      yield sentence;
    }
  }

  for (const sentence of splitter.flush()) {
    yield sentence;
  }
}
