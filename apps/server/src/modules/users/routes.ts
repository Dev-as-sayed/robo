import { Router } from "express";
import { registerPushTokenSchema, updateMeSchema } from "@robo/shared/schemas";
import {
  deleteMe,
  exportUserData,
  getMe,
  listPushTokens,
  registerPushToken,
  revokePushToken,
  updateMe,
} from "@robo/shared/users";
import { asyncHandler } from "../../http/async-handler";
import { sendSuccess } from "../../http/response";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";

const router = Router();

router.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await getMe(req.user!.id);
    sendSuccess(res, { code: "USER_FETCHED", data: { user } });
  })
);

router.patch(
  "/me",
  authenticate,
  validate({ body: updateMeSchema }),
  asyncHandler(async (req, res) => {
    const user = await updateMe(req.user!.id, req.body);
    sendSuccess(res, {
      code: "USER_UPDATED",
      message: "User updated successfully",
      data: { user },
    });
  })
);

router.post(
  "/me/push-token",
  authenticate,
  validate({ body: registerPushTokenSchema }),
  asyncHandler(async (req, res) => {
    const pushToken = await registerPushToken(req.user!.id, req.body);
    sendSuccess(res, {
      code: "PUSH_TOKEN_REGISTERED",
      message: "Push token registered successfully",
      data: { pushToken },
    });
  })
);

router.get(
  "/me/push-tokens",
  authenticate,
  asyncHandler(async (req, res) => {
    const pushTokens = await listPushTokens(req.user!.id);
    sendSuccess(res, { code: "PUSH_TOKENS_FETCHED", data: { pushTokens } });
  })
);

router.delete(
  "/me/push-token/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await revokePushToken(req.user!.id, req.params.id);
    sendSuccess(res, {
      code: "PUSH_TOKEN_REVOKED",
      message: "Push token revoked successfully",
      data: result,
    });
  })
);

router.post(
  "/me/export",
  authenticate,
  asyncHandler(async (req, res) => {
    const data = await exportUserData(req.user!.id);
    sendSuccess(res, {
      code: "USER_DATA_EXPORTED",
      message: "User data exported successfully",
      data,
    });
  })
);

router.delete(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await deleteMe(req.user!.id);
    sendSuccess(res, {
      code: "USER_DELETED",
      message: "User account deleted successfully",
      data: result,
    });
  })
);

export default router;
