import { Router } from "express";
import { createReminderSchema, updateReminderSchema } from "@robo/shared/schemas";
import {
  createReminder,
  deleteReminder,
  getReminders,
  snoozeReminder,
  updateReminder,
} from "@robo/shared/reminders";
import { asyncHandler } from "../../http/async-handler";
import { sendSuccess } from "../../http/response";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";

const router = Router();

router.post(
  "/",
  authenticate,
  validate({ body: createReminderSchema }),
  asyncHandler(async (req, res) => {
    const reminder = await createReminder(req.user!.id, req.body);
    sendSuccess(res, {
      status: 201,
      code: "REMINDER_CREATED",
      message: "Reminder created successfully",
      data: { reminder },
    });
  })
);

router.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const reminders = await getReminders(req.user!.id, {
      status: req.query.status as string | undefined,
      channel: req.query.channel as string | undefined,
    });
    sendSuccess(res, { code: "REMINDERS_FETCHED", data: { reminders } });
  })
);

router.patch(
  "/:id",
  authenticate,
  validate({ body: updateReminderSchema }),
  asyncHandler(async (req, res) => {
    const reminder = await updateReminder(req.user!.id, req.params.id, req.body);
    sendSuccess(res, {
      code: "REMINDER_UPDATED",
      message: "Reminder updated successfully",
      data: { reminder },
    });
  })
);

router.delete(
  "/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    await deleteReminder(req.user!.id, req.params.id);
    sendSuccess(res, { code: "REMINDER_DELETED", message: "Reminder deleted successfully" });
  })
);

router.post(
  "/:id/snooze",
  authenticate,
  asyncHandler(async (req, res) => {
    const reminder = await snoozeReminder(req.user!.id, req.params.id);
    sendSuccess(res, {
      code: "REMINDER_SNOOZED",
      message: "Reminder snoozed successfully",
      data: { reminder },
    });
  })
);

export default router;
