import type { RetrievedChunk } from "../ai/qdrant";

const CONTROL_TOKEN_PATTERNS = [
  /<\|im_start\|>/gi,
  /<\|im_end\|>/gi,
  /<\|system\|>/gi,
  /\[\/?INST\]/gi,
  /<\/?s>/gi,
  /```(?:system|assistant|instruction)/gi,
];

const INJECTION_PATTERNS = [
  /\bignore\s+(?:all\s+|any\s+)?(?:the\s+)?(?:previous|above|prior)\s+instructions?\b/i,
  /\bdisregard\s+(?:all\s+|any\s+)?(?:the\s+)?(?:previous|above|prior)\s+(?:instructions?|prompts?|rules?)\b/i,
  /\byou\s+are\s+now\s+(?:a|an|the)\b/i,
  /\b(?:reveal|print|show)\s+(?:the\s+)?system\s+prompt\b/i,
  /\b(?:new|updated)\s+system\s+(?:prompt|instructions?)\b/i,
  /\bdo\s+not\s+follow\s+(?:the\s+)?(?:system|developer|previous)\b/i,
];

export interface SanitizedChunk {
  text: string;
  flagged: boolean;
}

/**
 * Document text is untrusted input. Control tokens are removed outright and
 * instruction-like passages are still returned (they may be legitimate study
 * material) but flagged so the tool result and prompt can mark them as data.
 */
export function sanitizeDocumentText(text: string): SanitizedChunk {
  let sanitized = text;
  for (const pattern of CONTROL_TOKEN_PATTERNS) {
    sanitized = sanitized.replace(pattern, " ");
  }

  sanitized = sanitized.replace(/\s+/g, " ").trim();
  const flagged = INJECTION_PATTERNS.some((pattern) => pattern.test(sanitized));

  return { text: sanitized, flagged };
}

export interface DocumentSearchResult {
  chunks: Array<RetrievedChunk & { flagged: boolean }>;
  notFound: boolean;
  message: string;
}

export const NOT_FOUND_IN_MATERIALS =
  "I couldn't find that in your uploaded materials.";

export function buildDocumentSearchResult(
  chunks: readonly RetrievedChunk[]
): DocumentSearchResult {
  const sanitized = chunks.map((chunk) => {
    const result = sanitizeDocumentText(chunk.text);
    return { ...chunk, text: result.text, flagged: result.flagged };
  });

  if (sanitized.length === 0) {
    return {
      chunks: [],
      notFound: true,
      message: NOT_FOUND_IN_MATERIALS,
    };
  }

  return {
    chunks: sanitized,
    notFound: false,
    message: "Answer only from these passages and cite the source.",
  };
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

/** Deterministic fallback when no LLM is configured for summarisation. */
export function buildExtractiveSummary(
  chunks: readonly RetrievedChunk[],
  maxSentences = 6
): string {
  const seen = new Set<string>();
  const sentences: string[] = [];

  for (const chunk of chunks) {
    const sanitized = sanitizeDocumentText(chunk.text).text;
    for (const sentence of splitSentences(sanitized)) {
      const key = sentence.toLowerCase();
      if (key.length < 20 || seen.has(key)) {
        continue;
      }
      seen.add(key);
      sentences.push(sentence);
      if (sentences.length >= maxSentences) {
        return sentences.join(" ");
      }
    }
  }

  return sentences.join(" ");
}
