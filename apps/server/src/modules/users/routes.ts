import { Router } from "express";
import { updateMeSchema } from "@robo/shared/schemas";
import { deleteMe, exportUserData, getMe, updateMe } from "@robo/shared/users";
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
