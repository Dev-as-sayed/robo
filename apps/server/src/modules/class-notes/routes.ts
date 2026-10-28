import { Router } from "express";
import {
  classNoteQuerySchema,
  createClassNoteSchema,
  updateClassNoteSchema,
} from "@robo/shared/schemas";
import {
  createClassNote,
  deleteClassNote,
  getClassNote,
  getClassNotes,
  updateClassNote,
} from "@robo/shared/class-notes";
import { asyncHandler } from "../../http/async-handler";
import { sendSuccess } from "../../http/response";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";

const router = Router();

router.get(
  "/",
  authenticate,
  validate({ query: classNoteQuerySchema }),
  asyncHandler(async (req, res) => {
    const notes = await getClassNotes(req.user!.id, req.query as never);
    sendSuccess(res, { code: "CLASS_NOTES_FETCHED", data: { notes } });
  })
);

router.get(
  "/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const note = await getClassNote(req.user!.id, req.params.id);
    sendSuccess(res, { code: "CLASS_NOTE_FETCHED", data: { note } });
  })
);

router.post(
  "/",
  authenticate,
  validate({ body: createClassNoteSchema }),
  asyncHandler(async (req, res) => {
    const note = await createClassNote(req.user!.id, {
      ...req.body,
      ...(req.body.classAt ? { classAt: new Date(req.body.classAt) } : {}),
    });
    sendSuccess(res, {
      status: 201,
      code: "CLASS_NOTE_CREATED",
      message: "Class note saved",
      data: { note },
    });
  })
);

router.patch(
  "/:id",
  authenticate,
  validate({ body: updateClassNoteSchema }),
  asyncHandler(async (req, res) => {
    const note = await updateClassNote(req.user!.id, req.params.id, {
      ...req.body,
      ...(req.body.classAt ? { classAt: new Date(req.body.classAt) } : {}),
    });
    sendSuccess(res, {
      code: "CLASS_NOTE_UPDATED",
      message: "Class note updated",
      data: { note },
    });
  })
);

router.delete(
  "/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    await deleteClassNote(req.user!.id, req.params.id);
    sendSuccess(res, {
      code: "CLASS_NOTE_DELETED",
      message: "Class note deleted",
    });
  })
);

export default router;
