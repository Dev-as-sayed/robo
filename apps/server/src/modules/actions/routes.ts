import { Router } from "express";
import { getActionLogs } from "@robo/shared/action-logs";
import { actionLogQuerySchema } from "@robo/shared/schemas";
import { asyncHandler } from "../../http/async-handler";
import { sendSuccess } from "../../http/response";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";

const router = Router();

router.get(
  "/",
  authenticate,
  validate({ query: actionLogQuerySchema }),
  asyncHandler(async (req, res) => {
    const actions = await getActionLogs(req.user!.id, Number(req.query.limit));
    sendSuccess(res, { code: "ACTION_LOGS_FETCHED", data: { actions } });
  })
);

export default router;
