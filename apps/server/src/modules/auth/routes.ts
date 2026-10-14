import { Router, Request, Response, NextFunction } from "express";
import { registerSchema, loginSchema } from "../../shared/schemas";
import { register, login } from "../../shared/auth";
import { authenticate } from "../middleware/auth";

const router = Router();

router.post("/register", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = registerSchema.parse(req.body);
    const user = await register(body);
    res.status(201).json({
      code: "USER_CREATED",
      data: { user },
    });
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = loginSchema.parse(req.body);
    const result = await login(body);
    res.json({
      code: "LOGIN_SUCCESS",
      data: { token: result.token, user: result.user },
    });
  } catch (error) {
    next(error);
  }
});

router.post("/refresh", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.body;
    const result = await refreshToken(token);
    res.json({
      code: "TOKEN_REFRESHED",
      data: { token: result.token, user: result.user },
    });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await revokeToken(req.user.id);
    res.json({
      code: "LOGOUT_SUCCESS",
    });
  } catch (error) {
    next(error);
  }
});

export default router;