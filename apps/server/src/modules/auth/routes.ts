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
  logoutByRefreshToken,
  refreshSession,
  register,
} from "@robo/shared/auth";
import { UnauthorizedError } from "../../errors/app-error";
import { asyncHandler } from "../../http/async-handler";
import { sendSuccess } from "../../http/response";
import { authenticateOptional } from "../../middleware/authenticate";
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
  }),
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
  }),
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
  }),
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
  }),
);

router.post(
  "/logout",
  authenticateOptional,
  validate({ body: logoutSchema }),
  asyncHandler(async (req, res) => {
    const refreshToken = req.body.refreshToken as string | undefined;
    let result: { revoked: number };

    if (req.body.allSessions) {
      if (!req.user) {
        throw new UnauthorizedError(
          "Authentication required to revoke all sessions",
          "MISSING_AUTH_TOKEN",
        );
      }
      result = await logout(req.user.id, { allSessions: true });
    } else if (refreshToken) {
      result = await logoutByRefreshToken(refreshToken, req.user?.id);
    } else if (req.user) {
      result = await logout(req.user.id);
    } else {
      throw new UnauthorizedError(
        "A refresh token or access token is required",
        "MISSING_AUTH_TOKEN",
      );
    }

    sendSuccess(res, {
      code: "LOGOUT_SUCCESS",
      message: "Logged out successfully",
      data: result,
    });
  }),
);

export default router;
