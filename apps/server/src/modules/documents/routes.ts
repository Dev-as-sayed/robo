import { Router } from "express";
import multer from "multer";
import { deleteDocument, getDocuments, uploadDocument } from "@robo/shared/documents";
import { BadRequestError } from "../../errors/app-error";
import { asyncHandler } from "../../http/async-handler";
import { sendSuccess } from "../../http/response";
import { authenticate } from "../../middleware/authenticate";

const upload = multer({ dest: "/tmp/uploads/" });

const router = Router();

router.post(
  "/upload",
  authenticate,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new BadRequestError("A file is required", "FILE_REQUIRED");
    }

    const document = await uploadDocument(req.user!.id, req.file, req.body);
    sendSuccess(res, {
      status: 201,
      code: "DOCUMENT_UPLOADED",
      message: "Document uploaded successfully",
      data: { document },
    });
  })
);

router.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const documents = await getDocuments(req.user!.id);
    sendSuccess(res, { code: "DOCUMENTS_FETCHED", data: { documents } });
  })
);

router.delete(
  "/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    await deleteDocument(req.user!.id, req.params.id);
    sendSuccess(res, { code: "DOCUMENT_DELETED", message: "Document deleted successfully" });
  })
);

export default router;
