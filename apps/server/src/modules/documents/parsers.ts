import { createCanvas } from "@napi-rs/canvas";
import JSZip from "jszip";
import logger from "../../lib/logger";
import { ocrImage } from "./ocr";

export interface ParsedPage {
  page: number | null;
  text: string;
  ocr: boolean;
}

export interface ParsedDocument {
  pages: ParsedPage[];
  pageCount: number;
  usedOcr: boolean;
}

export interface ParseDocumentOptions {
  mimeType: string;
  filename: string;
  pdfMinTextChars: number;
}

type PdfTextItem = { str?: string };

function normalizeText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .split(String.fromCharCode(0)).join("")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function parseText(buffer: Buffer): Promise<ParsedDocument> {
  const text = normalizeText(buffer.toString("utf8").replace(/^\uFEFF/, ""));
  return {
    pages: text ? [{ page: 1, text, ocr: false }] : [],
    pageCount: text ? 1 : 0,
    usedOcr: false,
  };
}

async function parseDocx(buffer: Buffer): Promise<ParsedDocument> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  const text = normalizeText(result.value);
  return {
    pages: text ? [{ page: 1, text, ocr: false }] : [],
    pageCount: text ? 1 : 0,
    usedOcr: false,
  };
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, String.fromCharCode(34))
    .replace(/&apos;/g, String.fromCharCode(39))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    );
}

function slideNumber(path: string): number {
  const match = path.match(/slide(\d+)\.xml$/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function extractSlideText(xml: string): string {
  const withBreaks = xml
    .replace(/<\/a:p>/g, "\n")
    .replace(/<a:br\s*\/>/g, "\n")
    .replace(/<a:tab\s*\/>/g, "\t");
  const matches = [...withBreaks.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)];
  return normalizeText(decodeXmlText(matches.map((match) => match[1] ?? "").join(" ")));
}

async function parsePptx(buffer: Buffer): Promise<ParsedDocument> {
  const zip = await JSZip.loadAsync(buffer);
  const slides = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((left, right) => slideNumber(left) - slideNumber(right));

  const pages: ParsedPage[] = [];
  for (const [index, name] of slides.entries()) {
    const xml = await zip.file(name)?.async("string");
    const text = xml ? extractSlideText(xml) : "";
    if (text) {
      pages.push({ page: index + 1, text, ocr: false });
    }
  }

  return { pages, pageCount: slides.length, usedOcr: false };
}

async function parsePdf(
  buffer: Buffer,
  options: ParseDocumentOptions
): Promise<ParsedDocument> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;
  const pages: ParsedPage[] = [];
  let usedOcr = false;

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      let text = normalizeText(
        content.items
          .map((item) => (item as PdfTextItem).str ?? "")
          .join(" ")
      );
      let ocr = false;

      if (text.length < options.pdfMinTextChars) {
        try {
          const viewport = page.getViewport({ scale: 2 });
          const canvas = createCanvas(
            Math.max(1, Math.ceil(viewport.width)),
            Math.max(1, Math.ceil(viewport.height))
          );
          await page.render({
            canvas: canvas as never,
            viewport,
          }).promise;
          const result = await ocrImage(canvas.toBuffer("image/png"));
          if (result.text.trim()) {
            text = normalizeText(result.text);
            ocr = true;
            usedOcr = true;
          }
        } catch (error) {
          logger.warn({ err: error, pageNumber }, "pdf page OCR failed");
        }
      }

      if (text) {
        pages.push({ page: pageNumber, text, ocr });
      }

      page.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }

  return { pages, pageCount: pdf.numPages, usedOcr };
}

async function parseImage(buffer: Buffer): Promise<ParsedDocument> {
  const result = await ocrImage(buffer);
  const text = normalizeText(result.text);
  return {
    pages: text ? [{ page: 1, text, ocr: true }] : [],
    pageCount: text ? 1 : 0,
    usedOcr: true,
  };
}

export async function parseDocument(
  buffer: Buffer,
  options: ParseDocumentOptions
): Promise<ParsedDocument> {
  switch (options.mimeType) {
    case "text/plain":
    case "text/markdown":
      return parseText(buffer);
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return parseDocx(buffer);
    case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      return parsePptx(buffer);
    case "application/pdf":
      return parsePdf(buffer, options);
    case "image/jpeg":
    case "image/png":
    case "image/webp":
      return parseImage(buffer);
    default:
      throw new Error(`DOCUMENT_TYPE_UNSUPPORTED:${options.mimeType}`);
  }
}
