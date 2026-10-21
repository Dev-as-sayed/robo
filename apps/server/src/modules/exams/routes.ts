import { Router } from "express";
import {
  createExamSchema,
  generateStudyPlanSchema,
  updateExamSchema,
} from "@robo/shared/schemas";
import {
  approvePlan,
  createExam,
  deleteExam,
  generatePlan,
  getExam,
  getReadiness,
  updateExam,
} from "@robo/shared/exams";
import { asyncHandler } from "../../http/async-handler";
import { sendSuccess } from "../../http/response";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";

const router = Router();

router.post(
  "/",
  authenticate,
  validate({ body: createExamSchema }),
  asyncHandler(async (req, res) => {
    const exam = await createExam(req.user!.id, req.body);
    sendSuccess(res, {
      status: 201,
      code: "EXAM_CREATED",
      message: "Exam created successfully",
      data: { exam },
    });
  })
);

router.get(
  "/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const exam = await getExam(req.user!.id, req.params.id);
    sendSuccess(res, { code: "EXAM_FETCHED", data: { exam } });
  })
);

router.patch(
  "/:id",
  authenticate,
  validate({ body: updateExamSchema }),
  asyncHandler(async (req, res) => {
    const exam = await updateExam(req.user!.id, req.params.id, req.body);
    sendSuccess(res, {
      code: "EXAM_UPDATED",
      message: "Exam updated successfully",
      data: { exam },
    });
  })
);

router.delete(
  "/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    await deleteExam(req.user!.id, req.params.id);
    sendSuccess(res, { code: "EXAM_DELETED", message: "Exam deleted successfully" });
  })
);

router.post(
  "/:id/plan",
  authenticate,
  validate({ body: generateStudyPlanSchema }),
  asyncHandler(async (req, res) => {
    const plan = await generatePlan(req.user!.id, req.params.id, req.body);
    sendSuccess(res, {
      status: 201,
      code: "PLAN_GENERATED",
      message: "Study plan generated successfully",
      data: { plan },
    });
  })
);

router.post(
  "/:id/plan/approve",
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await approvePlan(req.user!.id, req.params.id);
    sendSuccess(res, {
      code: "PLAN_APPROVED",
      message: "Study plan approved successfully",
      data: { result },
    });
  })
);

router.get(
  "/:id/readiness",
  authenticate,
  asyncHandler(async (req, res) => {
    const readiness = await getReadiness(req.user!.id, req.params.id);
    sendSuccess(res, { code: "READINESS_FETCHED", data: { readiness } });
  })
);

export default router;
