import { Router } from "express";
import { accountDeletionRequestSchema } from "@robo/shared/schemas";
import { asyncHandler } from "../../http/async-handler";
import { sendSuccess } from "../../http/response";
import { validate } from "../../middleware/validate";
import { createDeletionRequest } from "../users/deletion-requests";

const router = Router();

router.post(
  "/deletion-request",
  validate({ body: accountDeletionRequestSchema }),
  asyncHandler(async (req, res) => {
    await createDeletionRequest(req.body);

    sendSuccess(res, {
      status: 202,
      code: "ACCOUNT_DELETION_REQUESTED",
      message:
        "If an account matches this email, we will contact you to verify ownership before deleting it.",
      data: { received: true },
    });
  })
);

export default router;
