import { Router } from "express";
import {
  createSubjectSchema,
  createTopicSchema,
  subjectParamSchema,
  topicParamSchema,
  updateSubjectSchema,
  updateTopicSchema,
} from "@robo/shared/schemas";
import {
  createSubject,
  createTopic,
  deleteSubject,
  deleteTopic,
  getSubject,
  getSubjects,
  updateSubject,
  updateTopic,
} from "@robo/shared/subjects";
import { asyncHandler } from "../../http/async-handler";
import { sendSuccess } from "../../http/response";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";

const router = Router();

router.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const subjects = await getSubjects(req.user!.id);
    sendSuccess(res, { code: "SUBJECTS_FETCHED", data: { subjects } });
  })
);

router.post(
  "/",
  authenticate,
  validate({ body: createSubjectSchema }),
  asyncHandler(async (req, res) => {
    const subject = await createSubject(req.user!.id, req.body);
    sendSuccess(res, {
      status: 201,
      code: "SUBJECT_CREATED",
      message: "Subject created successfully",
      data: { subject },
    });
  })
);

router.get(
  "/:id",
  authenticate,
  validate({ params: subjectParamSchema }),
  asyncHandler(async (req, res) => {
    const subject = await getSubject(req.user!.id, req.params.id);
    sendSuccess(res, { code: "SUBJECT_FETCHED", data: { subject } });
  })
);

router.patch(
  "/:id",
  authenticate,
  validate({ params: subjectParamSchema, body: updateSubjectSchema }),
  asyncHandler(async (req, res) => {
    const subject = await updateSubject(req.user!.id, req.params.id, req.body);
    sendSuccess(res, {
      code: "SUBJECT_UPDATED",
      message: "Subject updated successfully",
      data: { subject },
    });
  })
);

router.delete(
  "/:id",
  authenticate,
  validate({ params: subjectParamSchema }),
  asyncHandler(async (req, res) => {
    await deleteSubject(req.user!.id, req.params.id);
    sendSuccess(res, { code: "SUBJECT_DELETED", message: "Subject deleted successfully" });
  })
);

router.post(
  "/:id/topics",
  authenticate,
  validate({ params: subjectParamSchema, body: createTopicSchema }),
  asyncHandler(async (req, res) => {
    const topic = await createTopic(req.user!.id, req.params.id, req.body);
    sendSuccess(res, {
      status: 201,
      code: "TOPIC_CREATED",
      message: "Topic created successfully",
      data: { topic },
    });
  })
);

router.patch(
  "/:id/topics/:topicId",
  authenticate,
  validate({ params: topicParamSchema, body: updateTopicSchema }),
  asyncHandler(async (req, res) => {
    const topic = await updateTopic(
      req.user!.id,
      req.params.id,
      req.params.topicId,
      req.body
    );
    sendSuccess(res, {
      code: "TOPIC_UPDATED",
      message: "Topic updated successfully",
      data: { topic },
    });
  })
);

router.delete(
  "/:id/topics/:topicId",
  authenticate,
  validate({ params: topicParamSchema }),
  asyncHandler(async (req, res) => {
    await deleteTopic(req.user!.id, req.params.id, req.params.topicId);
    sendSuccess(res, { code: "TOPIC_DELETED", message: "Topic deleted successfully" });
  })
);

export default router;
