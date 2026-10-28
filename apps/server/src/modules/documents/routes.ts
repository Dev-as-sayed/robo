import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import {
  completeDocumentUploadSchema,
  documentUploadUrlSchema,
} from "@robo/shared/schemas";
import {
  createDocument,
  deleteDocument,
  getDocument,
  getDocuments,
  updateDocument,
  type Document,
} from "@robo/shared/documents";
import { AppError, BadRequestError, NotFoundError } from "../../errors/app-error";
import { asyncHandler } from "../../http/async-handler";
import { sendSuccess } from "../../http/response";
import { env } from "../../config/env";
import logger from "../../lib/logger";
import {
  createSignedDownloadUrl,
  createSignedUploadUrl,
  deleteStorageObject,
  headStorageObject,
  isStorageConfigured,
  putStorageObject,
} from "../../lib/storage";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";
import { deleteDocumentChunks, isRagConfigured } from "../ai/qdrant";
import { requeueDocument } from "./queue";
import {
  assertAllowedMimeType,
  assertDocumentQuota,
  assertFileSize,
  assertStorageConfigured,
  buildDocumentStorageKey,
  buildFallbackFilename,
  checksumBuffer,
  toDocumentResponse,
  type DocumentResponse,
} from "./upload";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.DOCUMENT_MAX_FILE_BYTES, files: 1 },
});

const router = Router();

function uploadSingleFile(req: Request, res: Response, next: NextFunction): void {
  upload.single("file")(req, res, (error: unknown) => {
    if (error && typeof error === "object" && "code" in error) {
      if ((error as { code?: string }).code === "LIMIT_FILE_SIZE") {
        next(
          new AppError(
            `Files must be ${Math.floor(env.DOCUMENT_MAX_FILE_BYTES / (1024 * 1024))} MB or smaller.`,
            { statusCode: 413, code: "DOCUMENT_TOO_LARGE" }
          )
        );
        return;
      }
    }

    if (error) {
      next(error);
      return;
    }

    next();
  });
}

function subjectFrom(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const subject = value.trim().slice(0, 100);
  return subject || null;
}

async function withDownloadUrl(document: Document): Promise<DocumentResponse> {
  if (!document.s3Key || document.status === "pending" || !isStorageConfigured()) {
    return toDocumentResponse(document, null);
  }

  try {
    const download = await createSignedDownloadUrl(document.s3Key, {
      filename: document.originalName,
    });
    return toDocumentResponse(document, download);
  } catch (error) {
    logger.warn(
      { err: error, documentId: document.id },
      "failed to sign document download url"
    );
    return toDocumentResponse(document, null);
  }
}

async function removeStoredDocument(document: Document): Promise<void> {
  if (isRagConfigured() && document.chunkCount > 0) {
    await deleteDocumentChunks(document.userId, document.id);
  }

  if (document.s3Key && isStorageConfigured()) {
    await deleteStorageObject(document.s3Key);
  }
}

router.post(
  "/upload",
  authenticate,
  uploadSingleFile,
  asyncHandler(async (req, res) => {
    assertStorageConfigured();

    if (!req.file) {
      throw new BadRequestError("A file is required", "FILE_REQUIRED");
    }

    const mimeType = assertAllowedMimeType(req.file.mimetype);
    assertFileSize(req.file.size);

    const userId = req.user!.id;
    await assertDocumentQuota(userId, req.file.size);

    const originalName = req.file.originalname.slice(0, 255);
    const storageKey = buildDocumentStorageKey(userId, originalName);
    const checksum = checksumBuffer(req.file.buffer);

    try {
      await putStorageObject({
        key: storageKey,
        body: req.file.buffer,
        contentType: mimeType,
        metadata: { userId, originalName: encodeURIComponent(originalName) },
      });
    } catch (error) {
      logger.error({ err: error, userId }, "document storage upload failed");
      throw new AppError("The file could not be stored. Try again.", {
        statusCode: 502,
        code: "STORAGE_UPLOAD_FAILED",
        cause: error,
      });
    }

    let document: Document;
    try {
      document = await createDocument(userId, {
        filename: buildFallbackFilename(originalName, mimeType),
        originalName,
        size: req.file.size,
        mimeType,
        s3Key: storageKey,
        subject: subjectFrom(req.body?.subject),
        checksum,
        status: "uploaded",
      });
    } catch (error) {
      await deleteStorageObject(storageKey).catch((cleanupError: unknown) => {
        logger.warn({ err: cleanupError, storageKey }, "failed to roll back stored file");
      });
      throw error;
    }

    sendSuccess(res, {
      status: 201,
      code: "DOCUMENT_UPLOADED",
      message: "Document uploaded successfully",
      data: { document: await withDownloadUrl(document) },
    });
  })
);

router.post(
  "/upload-url",
  authenticate,
  validate({ body: documentUploadUrlSchema }),
  asyncHandler(async (req, res) => {
    assertStorageConfigured();

    const body = req.body as {
      originalName: string;
      mimeType: string;
      size: number;
      subject?: string;
    };
    const mimeType = assertAllowedMimeType(body.mimeType);
    assertFileSize(body.size);

    const userId = req.user!.id;
    await assertDocumentQuota(userId, body.size);

    const originalName = body.originalName.slice(0, 255);
    const storageKey = buildDocumentStorageKey(userId, originalName);
    const upload = await createSignedUploadUrl({ key: storageKey, contentType: mimeType });

    const document = await createDocument(userId, {
      filename: buildFallbackFilename(originalName, mimeType),
      originalName,
      size: body.size,
      mimeType,
      s3Key: storageKey,
      subject: body.subject ?? null,
      status: "pending",
    });

    sendSuccess(res, {
      status: 201,
      code: "DOCUMENT_UPLOAD_URL_CREATED",
      message: "Upload URL created",
      data: {
        document: toDocumentResponse(document, null),
        upload: {
          key: upload.key,
          url: upload.url,
          method: upload.method,
          headers: upload.headers,
          expiresAt: upload.expiresAt.toISOString(),
        },
      },
    });
  })
);

router.post(
  "/:id/complete",
  authenticate,
  validate({ body: completeDocumentUploadSchema }),
  asyncHandler(async (req, res) => {
    assertStorageConfigured();

    const body = req.body as { size?: number; checksum?: string };
    const document = await getDocument(req.user!.id, req.params.id);

    if (!document) {
      throw new NotFoundError("Document not found", "DOCUMENT_NOT_FOUND");
    }

    if (document.status !== "pending") {
      throw new AppError("This upload has already been completed.", {
        statusCode: 409,
        code: "DOCUMENT_UPLOAD_ALREADY_COMPLETED",
      });
    }

    if (!document.s3Key) {
      throw new BadRequestError("This document has no storage key.", "DOCUMENT_STORAGE_KEY_MISSING");
    }

    const stored = await headStorageObject(document.s3Key);

    if (!stored) {
      throw new BadRequestError(
        "The uploaded file was not found in storage.",
        "DOCUMENT_UPLOAD_NOT_FOUND"
      );
    }

    assertFileSize(stored.size);

    if (document.size !== stored.size || (body.size && body.size !== stored.size)) {
      throw new BadRequestError(
        "The uploaded file size does not match the declared size.",
        "DOCUMENT_SIZE_MISMATCH"
      );
    }

    if (stored.contentType && stored.contentType !== "application/octet-stream") {
      const storedMimeType = assertAllowedMimeType(stored.contentType);
      if (storedMimeType !== document.mimeType) {
        throw new BadRequestError(
          "The uploaded file type does not match the declared type.",
          "DOCUMENT_TYPE_MISMATCH"
        );
      }
    }

    const updated = await updateDocument(req.user!.id, document.id, {
      status: "uploaded",
      ...(body.checksum ? { checksum: body.checksum.toLowerCase() } : {}),
    });

    sendSuccess(res, {
      code: "DOCUMENT_UPLOAD_COMPLETED",
      message: "Upload completed",
      data: { document: await withDownloadUrl(updated) },
    });
  })
);

router.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const documents = await getDocuments(req.user!.id);
    sendSuccess(res, {
      code: "DOCUMENTS_FETCHED",
      data: { documents: documents.map((document) => toDocumentResponse(document, null)) },
    });
  })
);

router.get(
  "/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const document = await getDocument(req.user!.id, req.params.id);

    if (!document) {
      throw new NotFoundError("Document not found", "DOCUMENT_NOT_FOUND");
    }

    sendSuccess(res, {
      code: "DOCUMENT_FETCHED",
      data: { document: await withDownloadUrl(document) },
    });
  })
);

router.get(
  "/:id/download-url",
  authenticate,
  asyncHandler(async (req, res) => {
    const document = await getDocument(req.user!.id, req.params.id);

    if (!document) {
      throw new NotFoundError("Document not found", "DOCUMENT_NOT_FOUND");
    }

    if (!document.s3Key || document.status === "pending") {
      throw new BadRequestError(
        "This document is not available for download yet.",
        "DOCUMENT_NOT_READY"
      );
    }

    const download = await createSignedDownloadUrl(document.s3Key, {
      filename: document.originalName,
    });

    sendSuccess(res, {
      code: "DOCUMENT_DOWNLOAD_URL_CREATED",
      data: {
        downloadUrl: download.url,
        expiresAt: download.expiresAt.toISOString(),
      },
    });
  })
);

router.post(
  "/:id/reindex",
  authenticate,
  asyncHandler(async (req, res) => {
    const document = await getDocument(req.user!.id, req.params.id);

    if (!document) {
      throw new NotFoundError("Document not found", "DOCUMENT_NOT_FOUND");
    }

    await requeueDocument(req.user!.id, document.id);
    const queued = await getDocument(req.user!.id, document.id);

    sendSuccess(res, {
      code: "DOCUMENT_REINDEX_QUEUED",
      message: "Document queued for re-indexing",
      data: { document: queued ? toDocumentResponse(queued, null) : null },
    });
  })
);

router.delete(
  "/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const document = await getDocument(req.user!.id, req.params.id);

    if (!document) {
      throw new NotFoundError("Document not found", "DOCUMENT_NOT_FOUND");
    }

    await removeStoredDocument(document);
    await deleteDocument(req.user!.id, document.id);

    sendSuccess(res, { code: "DOCUMENT_DELETED", message: "Document deleted successfully" });
  })
);

export default router;
