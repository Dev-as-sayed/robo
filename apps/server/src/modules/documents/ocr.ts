import { env } from "../../config/env";
import logger from "../../lib/logger";

const OCR_MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export interface OcrResult {
  text: string;
  confidence: number;
  engine: "tesseract" | "vision";
}

type TesseractWorker = {
  recognize: (image: Buffer) => Promise<{ data: { text: string; confidence: number } }>;
  terminate: () => Promise<unknown>;
};

let workerPromise: Promise<TesseractWorker> | null = null;

async function getWorker(): Promise<TesseractWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker(env.OCR_LANGUAGE);
      return worker as unknown as TesseractWorker;
    })().catch((error: unknown) => {
      workerPromise = null;
      throw error;
    });
  }

  return workerPromise;
}

export async function closeOcrWorker(): Promise<void> {
  if (!workerPromise) {
    return;
  }

  const pending = workerPromise;
  workerPromise = null;

  try {
    const worker = await pending;
    await worker.terminate();
  } catch {
    // A worker that never initialised has nothing to terminate.
  }
}

function imageMimeType(buffer: Buffer): "image/jpeg" | "image/png" | "image/webp" {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    return "image/jpeg";
  }
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }
  return "image/png";
}

async function visionTranscribe(buffer: Buffer): Promise<string | null> {
  if (!env.OCR_VISION_FALLBACK || buffer.length > OCR_MAX_IMAGE_BYTES) {
    return null;
  }

  try {
    const { explainImage } = await import("../ai/vision");
    const result = await explainImage({
      imageBase64: buffer.toString("base64"),
      mimeType: imageMimeType(buffer),
      question:
        "Transcribe every piece of text visible in this study image exactly as written. Preserve line breaks and formulas. Return only the transcription; do not explain or summarise.",
    });
    return result.answer.trim() || null;
  } catch (error) {
    logger.warn({ err: error }, "vision OCR fallback failed");
    return null;
  }
}

/**
 * Runs Tesseract first. When OCR produces too little text and the vision fallback
 * is enabled, the configured vision model transcribes the image instead.
 */
export async function ocrImage(buffer: Buffer): Promise<OcrResult> {
  if (!env.OCR_ENABLED) {
    throw new Error("OCR_DISABLED");
  }

  let tesseractText = "";
  let confidence = 0;

  try {
    const worker = await getWorker();
    const result = await worker.recognize(buffer);
    tesseractText = result.data.text.trim();
    confidence = Number.isFinite(result.data.confidence) ? result.data.confidence : 0;
  } catch (error) {
    logger.warn({ err: error }, "tesseract OCR failed");
  }

  const hasUsefulText =
    tesseractText.length >= env.OCR_MIN_TEXT_CHARS &&
    confidence >= env.OCR_MIN_CONFIDENCE;

  if (hasUsefulText) {
    return { text: tesseractText, confidence, engine: "tesseract" };
  }

  const visionText = await visionTranscribe(buffer);
  if (visionText) {
    return { text: visionText, confidence, engine: "vision" };
  }

  return { text: tesseractText, confidence, engine: "tesseract" };
}
