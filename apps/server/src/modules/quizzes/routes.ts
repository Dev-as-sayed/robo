import { Router } from "express";
import {
  generateQuizSchema,
  submitQuizAttemptSchema,
} from "@robo/shared/schemas";
import {
  getQuiz,
  getQuizAttempts,
  getQuizzes,
  submitAttempt,
} from "@robo/shared/quizzes";
import { generateQuizWithAi } from "./generator";
import { asyncHandler } from "../../http/async-handler";
import { sendSuccess } from "../../http/response";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";

const router = Router();

router.post(
  "/generate",
  authenticate,
  validate({ body: generateQuizSchema }),
  asyncHandler(async (req, res) => {
    const result = await generateQuizWithAi(req.user!.id, req.body);
    sendSuccess(res, {
      status: 201,
      code: "QUIZ_GENERATED",
      message: "Quiz generated successfully",
      data: { quiz: result.quiz, generatedAt: result.generatedAt },
    });
  })
);

router.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const quizzes = await getQuizzes(req.user!.id);
    sendSuccess(res, { code: "QUIZZES_FETCHED", data: { quizzes } });
  })
);

router.get(
  "/attempts",
  authenticate,
  asyncHandler(async (req, res) => {
    const attempts = await getQuizAttempts(req.user!.id);
    sendSuccess(res, { code: "QUIZ_ATTEMPTS_FETCHED", data: { attempts } });
  })
);

router.get(
  "/:id/attempts",
  authenticate,
  asyncHandler(async (req, res) => {
    const attempts = await getQuizAttempts(req.user!.id, req.params.id);
    sendSuccess(res, { code: "QUIZ_ATTEMPTS_FETCHED", data: { attempts } });
  })
);

router.get(
  "/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const quiz = await getQuiz(req.user!.id, req.params.id);
    sendSuccess(res, { code: "QUIZ_FETCHED", data: { quiz } });
  })
);

router.post(
  "/:id/attempts",
  authenticate,
  validate({ body: submitQuizAttemptSchema }),
  asyncHandler(async (req, res) => {
    const attempt = await submitAttempt(req.user!.id, req.params.id, req.body);
    sendSuccess(res, {
      status: 201,
      code: "QUIZ_ATTEMPT_SUBMITTED",
      message: "Quiz attempt submitted successfully",
      data: { attempt },
    });
  })
);

export default router;
