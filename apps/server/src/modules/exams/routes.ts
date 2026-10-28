import { Router } from "express";
import {
  createExamSchema,
  generateStudyPlanSchema,
  updateExamSchema,
} from "@robo/shared/schemas";
import {
  approvePlan,
  recalculatePlan,
  getRevisionSummary,
  createExam,
  deleteExam,
  generatePlan,
  getExam,
  getExams,
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
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const status = req.query.status as string | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;

    const exams = await getExams(req.user!.id, {
      ...(status === "draft" || status === "active" || status === "completed"
        ? { status }
        : {}),
      ...(from ? { from: new Date(from) } : {}),
      ...(to ? { to: new Date(to) } : {}),
    });
    sendSuccess(res, { code: "EXAMS_FETCHED", data: { exams } });
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

router.post(
  "/:id/plan/recalculate",
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await recalculatePlan(req.user!.id, req.params.id);
    sendSuccess(res, {
      code: "PLAN_RECALCULATED",
      message: "Remaining study tasks were rescheduled",
      data: { result },
    });
  })
);

router.get(
  "/:id/revision",
  authenticate,
  asyncHandler(async (req, res) => {
    const summary = await getRevisionSummary(req.user!.id, req.params.id);
    sendSuccess(res, { code: "REVISION_SUMMARY_FETCHED", data: { summary } });
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
