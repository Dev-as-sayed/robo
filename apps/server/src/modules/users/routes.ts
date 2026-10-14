import { Router, Request, Response, NextFunction } from "express";
import { getMe, updateMe } from "../../shared/users";
import { authenticate } from "../middleware/auth";

const router = Router();

router.get("/me", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await getMe(req.user!.id);
    res.json({
      code: "USER_FETCHED",
      data: { user },
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/me", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await updateMe(req.user!.id, req.body);
    res.json({
      code: "USER_UPDATED",
      data: { user },
    });
  } catch (error) {
    next(error);
  }
});

export default router;