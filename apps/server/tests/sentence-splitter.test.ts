import { describe, expect, it } from "vitest";
import {
  SentenceSplitter,
  sentencesFromStream,
  splitSentences,
} from "../src/modules/voice/sentence-splitter";

describe("sentence splitter", () => {
  it("splits complete sentences", () => {
    expect(splitSentences("Hello there. How are you? I am fine!")).toEqual([
      "Hello there.",
      "How are you?",
      "I am fine!",
    ]);
  });

  it("keeps abbreviations and decimal numbers together", () => {
    expect(
      splitSentences("Dr. Smith arrives at 3.5 pm. Then he leaves.")
    ).toEqual(["Dr. Smith arrives at 3.5 pm.", "Then he leaves."]);
  });

  it("splits on newlines", () => {
    expect(splitSentences("First line\nSecond line.")).toEqual([
      "First line",
      "Second line.",
    ]);
  });

  it("emits sentences incrementally while tokens stream in", () => {
    const splitter = new SentenceSplitter();
    const emitted: string[] = [];

    for (const chunk of ["Hello ", "there", ". How ", "are you?"]) {
      emitted.push(...splitter.push(chunk));
    }
    emitted.push(...splitter.flush());

    expect(emitted).toEqual(["Hello there.", "How are you?"]);
  });

  it("splits a long run without punctuation into speakable chunks", () => {
    const text = Array.from({ length: 80 }, (_, index) => `word${index}`).join(" ");
    const sentences = splitSentences(text);

    expect(sentences.length).toBeGreaterThan(1);
    for (const sentence of sentences) {
      expect(sentence.length).toBeLessThanOrEqual(240);
    }
    expect(sentences.join(" ")).toBe(text);
  });

  it("consumes an async token stream", async () => {
    async function* tokens(): AsyncGenerator<string> {
      yield "The exam is ";
      yield "on Monday. Bring ";
      yield "your notes.";
    }

    const sentences: string[] = [];
    for await (const sentence of sentencesFromStream(tokens())) {
      sentences.push(sentence);
    }

    expect(sentences).toEqual(["The exam is on Monday.", "Bring your notes."]);
  });
});
