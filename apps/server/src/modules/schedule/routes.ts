import { Router } from "express";
import {
  createScheduleSchema,
  scheduleExceptionSchema,
  updateScheduleSchema,
} from "@robo/shared/schemas";
import {
  addException,
  createSchedule,
  deleteSchedule,
  getSchedule,
  updateSchedule,
} from "@robo/shared/schedule";
import { asyncHandler } from "../../http/async-handler";
import { sendSuccess } from "../../http/response";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";

const router = Router();

router.post(
  "/",
  authenticate,
  validate({ body: createScheduleSchema }),
  asyncHandler(async (req, res) => {
    const schedule = await createSchedule(req.user!.id, req.body);
    sendSuccess(res, {
      status: 201,
      code: "SCHEDULE_CREATED",
      message: "Schedule entry created successfully",
      data: { schedule },
    });
  })
);

router.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const schedule = await getSchedule(req.user!.id);
    sendSuccess(res, { code: "SCHEDULE_FETCHED", data: { schedule } });
  })
);

router.patch(
  "/:id",
  authenticate,
  validate({ body: updateScheduleSchema }),
  asyncHandler(async (req, res) => {
    const schedule = await updateSchedule(req.user!.id, req.params.id, req.body);
    sendSuccess(res, {
      code: "SCHEDULE_UPDATED",
      message: "Schedule entry updated successfully",
      data: { schedule },
    });
  })
);

router.delete(
  "/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    await deleteSchedule(req.user!.id, req.params.id);
    sendSuccess(res, { code: "SCHEDULE_DELETED", message: "Schedule entry deleted successfully" });
  })
);

router.post(
  "/:id/exceptions",
  authenticate,
  validate({ body: scheduleExceptionSchema }),
  asyncHandler(async (req, res) => {
    const exception = await addException(req.user!.id, req.params.id, req.body);
    sendSuccess(res, {
      status: 201,
      code: "EXCEPTION_ADDED",
      message: "Schedule exception added successfully",
      data: { exception },
    });
  })
);

export default router;
