import { Router } from "express";
import {
  extendStudySessionSchema,
  startStudySessionSchema,
  studySessionQuerySchema,
} from "@robo/shared/schemas";
import {
  endStudySession,
  extendStudySession,
  getActiveStudySession,
  listStudySessions,
  pauseStudySession,
  resumeStudySession,
  startStudySession,
} from "@robo/shared/sessions";
import { asyncHandler } from "../../http/async-handler";
import { sendSuccess } from "../../http/response";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";

const router = Router();

router.get(
  "/active",
  authenticate,
  asyncHandler(async (req, res) => {
    const session = await getActiveStudySession(req.user!.id);
    sendSuccess(res, { code: "STUDY_SESSION_FETCHED", data: { session } });
  })
);

router.get(
  "/",
  authenticate,
  validate({ query: studySessionQuerySchema }),
  asyncHandler(async (req, res) => {
    const sessions = await listStudySessions(req.user!.id, Number(req.query.limit));
    sendSuccess(res, { code: "STUDY_SESSIONS_FETCHED", data: { sessions } });
  })
);

router.post(
  "/start",
  authenticate,
  validate({ body: startStudySessionSchema }),
  asyncHandler(async (req, res) => {
    const result = await startStudySession(req.user!.id, req.body);
    sendSuccess(res, {
      status: 201,
      code: "STUDY_SESSION_STARTED",
      message: "Study session started",
      data: result,
    });
  })
);

router.post(
  "/:id/pause",
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await pauseStudySession(req.user!.id, req.params.id);
    sendSuccess(res, { code: "STUDY_SESSION_PAUSED", data: result });
  })
);

router.post(
  "/:id/resume",
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await resumeStudySession(req.user!.id, req.params.id);
    sendSuccess(res, { code: "STUDY_SESSION_RESUMED", data: result });
  })
);

router.post(
  "/:id/extend",
  authenticate,
  validate({ body: extendStudySessionSchema }),
  asyncHandler(async (req, res) => {
    const result = await extendStudySession(
      req.user!.id,
      req.params.id,
      req.body.minutes
    );
    sendSuccess(res, { code: "STUDY_SESSION_EXTENDED", data: result });
  })
);

router.post(
  "/:id/end",
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await endStudySession(req.user!.id, req.params.id);
    sendSuccess(res, {
      code: "STUDY_SESSION_ENDED",
      message: "Study session ended",
      data: result,
    });
  })
);

export default router;
