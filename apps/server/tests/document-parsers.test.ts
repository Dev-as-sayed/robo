import { readFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ocrImage = vi.hoisted(() => vi.fn());

vi.mock("../src/modules/documents/ocr", () => ({ ocrImage }));

const { parseDocument } = await import("../src/modules/documents/parsers");

const options = {
  mimeType: "text/plain",
  filename: "notes.txt",
  pdfMinTextChars: 40,
};

async function docxBuffer(text: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    "<?xml version=\"1.0\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/></Types>"
  );
  zip
    .folder("_rels")
    ?.file(
      ".rels",
      "<?xml version=\"1.0\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/></Relationships>"
    );
  zip
    .folder("word")
    ?.file(
      "document.xml",
      `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`
    );
  return zip.generateAsync({ type: "nodebuffer" });
}

async function pptxBuffer(slides: string[]): Promise<Buffer> {
  const zip = new JSZip();
  slides.forEach((text, index) => {
    zip.file(
      `ppt/slides/slide${index + 1}.xml`,
      `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:sld>`
    );
  });
  return zip.generateAsync({ type: "nodebuffer" });
}

describe("document parsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ocrImage.mockResolvedValue({ text: "Photo notes", confidence: 90, engine: "tesseract" });
  });

  it("parses plain text and markdown as one page", async () => {
    const parsed = await parseDocument(Buffer.from("\uFEFFHello\r\nworld"), options);

    expect(parsed.pageCount).toBe(1);
    expect(parsed.pages).toEqual([{ page: 1, text: "Hello\nworld", ocr: false }]);
  });

  it("parses DOCX text through mammoth", async () => {
    const parsed = await parseDocument(await docxBuffer("Hello DOCX"), {
      ...options,
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    expect(parsed.pages[0]?.text).toContain("Hello DOCX");
    expect(parsed.pageCount).toBe(1);
  });

  it("keeps slide numbers for PPTX text", async () => {
    const parsed = await parseDocument(await pptxBuffer(["First slide", "Second slide"]), {
      ...options,
      mimeType:
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });

    expect(parsed.pageCount).toBe(2);
    expect(parsed.pages).toEqual([
      { page: 1, text: "First slide", ocr: false },
      { page: 2, text: "Second slide", ocr: false },
    ]);
  });

  it("extracts PDF text with page numbers", async () => {
    const buffer = await readFile(path.join(__dirname, "fixtures", "sample.pdf"));
    const parsed = await parseDocument(buffer, {
      ...options,
      mimeType: "application/pdf",
      filename: "sample.pdf",
    });

    expect(parsed.pageCount).toBe(1);
    expect(parsed.pages[0]?.page).toBe(1);
    expect(parsed.pages[0]?.text).toContain("Photosynthesis");
    expect(parsed.usedOcr).toBe(false);
  });

  it("uses OCR for images", async () => {
    const parsed = await parseDocument(Buffer.from("not-a-real-image"), {
      ...options,
      mimeType: "image/png",
      filename: "scan.png",
    });

    expect(ocrImage).toHaveBeenCalledOnce();
    expect(parsed).toMatchObject({
      pageCount: 1,
      usedOcr: true,
      pages: [{ page: 1, text: "Photo notes", ocr: true }],
    });
  });

  it("rejects unsupported formats", async () => {
    await expect(
      parseDocument(Buffer.from("x"), { ...options, mimeType: "application/zip" })
    ).rejects.toThrow("DOCUMENT_TYPE_UNSUPPORTED");
  });
});
