import { Router } from "express";
import { getActionLogs } from "@robo/shared/action-logs";
import {
  confirmPendingAction,
  listPendingActions,
  rejectPendingAction,
} from "@robo/shared/pending-actions";
import { actionLogQuerySchema } from "@robo/shared/schemas";
import { publishAppActionEvent } from "./events";
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

router.get(
  "/pending",
  authenticate,
  asyncHandler(async (req, res) => {
    const actions = await listPendingActions(req.user!.id);
    sendSuccess(res, { code: "PENDING_ACTIONS_FETCHED", data: { actions } });
  })
);

router.post(
  "/pending/:id/confirm",
  authenticate,
  asyncHandler(async (req, res) => {
    const action = await confirmPendingAction(req.user!.id, req.params.id);
    publishAppActionEvent(req.user!.id, "action.execute", action);
    sendSuccess(res, {
      code: "PENDING_ACTION_CONFIRMED",
      message: "Action confirmed",
      data: { action },
    });
  })
);

router.post(
  "/pending/:id/reject",
  authenticate,
  asyncHandler(async (req, res) => {
    const action = await rejectPendingAction(req.user!.id, req.params.id);
    sendSuccess(res, {
      code: "PENDING_ACTION_REJECTED",
      message: "Action rejected",
      data: { action },
    });
  })
);

export default router;
