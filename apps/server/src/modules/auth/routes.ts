import { Router } from "express";
import {
  googleSignInSchema,
  loginSchema,
  logoutSchema,
  refreshTokenSchema,
  registerSchema,
} from "@robo/shared/schemas";
import {
  googleLogin,
  login,
  logout,
  refreshSession,
  register,
} from "@robo/shared/auth";
import { asyncHandler } from "../../http/async-handler";
import { sendSuccess } from "../../http/response";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";

const router = Router();

router.post(
  "/register",
  validate({ body: registerSchema }),
  asyncHandler(async (req, res) => {
    const result = await register(req.body);
    sendSuccess(res, {
      status: 201,
      code: "USER_CREATED",
      message: "User registered successfully",
      data: result,
    });
  })
);

router.post(
  "/login",
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const result = await login(req.body);
    sendSuccess(res, {
      code: "LOGIN_SUCCESS",
      message: "Logged in successfully",
      data: result,
    });
  })
);

router.post(
  "/google",
  validate({ body: googleSignInSchema }),
  asyncHandler(async (req, res) => {
    const result = await googleLogin(req.body);
    sendSuccess(res, {
      code: "LOGIN_SUCCESS",
      message: "Logged in with Google successfully",
      data: result,
    });
  })
);

router.post(
  "/refresh",
  validate({ body: refreshTokenSchema }),
  asyncHandler(async (req, res) => {
    const result = await refreshSession(req.body.refreshToken);
    sendSuccess(res, {
      code: "TOKEN_REFRESHED",
      message: "Token refreshed successfully",
      data: result,
    });
  })
);

router.post(
  "/logout",
  authenticate,
  validate({ body: logoutSchema }),
  asyncHandler(async (req, res) => {
    const result = await logout(req.user!.id, req.body);
    sendSuccess(res, {
      code: "LOGOUT_SUCCESS",
      message: "Logged out successfully",
      data: result,
    });
  })
);

export default router;
