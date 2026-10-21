import { Router } from "express";
import {
  adminUserParamSchema,
  adminUserQuerySchema,
  updateUserRoleSchema,
  updateUserScopeSchema,
  updateUserStatusSchema,
  type AdminUserQueryInput,
} from "@robo/shared/schemas";
import {
  deleteUser,
  getUserById,
  getUserStats,
  listUsers,
  updateUserRole,
  updateUserScope,
  updateUserStatus,
} from "@robo/shared/users";
import { asyncHandler } from "../../http/async-handler";
import { sendSuccess } from "../../http/response";
import { authenticate } from "../../middleware/authenticate";
import { requireMinimumRole } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";

const router = Router();

router.use(authenticate);
router.use(requireMinimumRole("MODERATOR"));

router.get(
  "/users/stats",
  asyncHandler(async (req, res) => {
    const stats = await getUserStats(req.user!.id);
    sendSuccess(res, { code: "ADMIN_USER_STATS_FETCHED", data: stats });
  })
);

router.get(
  "/users",
  validate({ query: adminUserQuerySchema }),
  asyncHandler(async (req, res) => {
    const result = await listUsers(req.user!.id, req.query as unknown as AdminUserQueryInput);
    sendSuccess(res, { code: "ADMIN_USERS_FETCHED", data: result });
  })
);

router.get(
  "/users/:id",
  validate({ params: adminUserParamSchema }),
  asyncHandler(async (req, res) => {
    const user = await getUserById(req.user!.id, req.params.id);
    sendSuccess(res, { code: "ADMIN_USER_FETCHED", data: { user } });
  })
);

router.patch(
  "/users/:id/role",
  validate({ params: adminUserParamSchema, body: updateUserRoleSchema }),
  asyncHandler(async (req, res) => {
    const user = await updateUserRole(req.user!.id, req.params.id, req.body);
    sendSuccess(res, {
      code: "ADMIN_USER_ROLE_UPDATED",
      message: "User role updated successfully",
      data: { user },
    });
  })
);

router.patch(
  "/users/:id/status",
  validate({ params: adminUserParamSchema, body: updateUserStatusSchema }),
  asyncHandler(async (req, res) => {
    const user = await updateUserStatus(req.user!.id, req.params.id, req.body);
    sendSuccess(res, {
      code: "ADMIN_USER_STATUS_UPDATED",
      message: "User status updated successfully",
      data: { user },
    });
  })
);

router.patch(
  "/users/:id/scope",
  validate({ params: adminUserParamSchema, body: updateUserScopeSchema }),
  asyncHandler(async (req, res) => {
    const user = await updateUserScope(req.user!.id, req.params.id, req.body);
    sendSuccess(res, {
      code: "ADMIN_USER_SCOPE_UPDATED",
      message: "User scope updated successfully",
      data: { user },
    });
  })
);

router.delete(
  "/users/:id",
  validate({ params: adminUserParamSchema }),
  asyncHandler(async (req, res) => {
    const result = await deleteUser(req.user!.id, req.params.id);
    sendSuccess(res, {
      code: "ADMIN_USER_DELETED",
      message: "User deleted successfully",
      data: result,
    });
  })
);

export default router;
