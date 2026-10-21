import { Router } from "express";
import { analyticsQuerySchema } from "@robo/shared/schemas";
import { getAnalyticsBySubject, getAnalyticsSummary } from "@robo/shared/analytics";
import { asyncHandler } from "../../http/async-handler";
import { sendSuccess } from "../../http/response";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";

const router = Router();

router.get(
  "/summary",
  authenticate,
  validate({ query: analyticsQuerySchema }),
  asyncHandler(async (req, res) => {
    const summary = await getAnalyticsSummary(req.user!.id, req.query);
    sendSuccess(res, { code: "ANALYTICS_SUMMARY", data: { summary } });
  })
);

router.get(
  "/subjects/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const summary = await getAnalyticsBySubject(req.user!.id, req.params.id);
    sendSuccess(res, { code: "ANALYTICS_BY_SUBJECT", data: { summary } });
  })
);

export default router;
