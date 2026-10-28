import { Router } from "express";
import {
  registerPushTokenSchema,
  updateConsentSchema,
  updateMeSchema,
} from "@robo/shared/schemas";
import { isConsentKind, listConsentRecords, recordConsent } from "@robo/shared/consents";
import {
  deleteMe,
  exportUserData,
  getMe,
  listPushTokens,
  registerPushToken,
  revokePushToken,
  updateMe,
} from "@robo/shared/users";
import { deleteAccountData } from "./account-deletion";
import { asyncHandler } from "../../http/async-handler";
import { sendSuccess } from "../../http/response";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";
import { BadRequestError } from "../../errors/app-error";

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

router.get(
  "/me/consents",
  authenticate,
  asyncHandler(async (req, res) => {
    const consents = await listConsentRecords(req.user!.id);
    sendSuccess(res, { code: "CONSENTS_FETCHED", data: { consents } });
  })
);

router.put(
  "/me/consents/:kind",
  authenticate,
  validate({ body: updateConsentSchema }),
  asyncHandler(async (req, res) => {
    const kind = req.params.kind?.toUpperCase() ?? "";

    if (!isConsentKind(kind)) {
      throw new BadRequestError("Unknown consent kind", "CONSENT_KIND_INVALID");
    }

    const consent = await recordConsent(req.user!.id, kind, req.body);
    sendSuccess(res, {
      code: "CONSENT_UPDATED",
      message: "Consent preference saved",
      data: { consent },
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
    const result = await deleteAccountData(req.user!.id);
    sendSuccess(res, {
      code: "USER_DELETED",
      message: "User account deleted successfully",
      data: result,
    });
  })
);

export default router;
