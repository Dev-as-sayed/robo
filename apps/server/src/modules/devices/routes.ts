import { Router, Request, Response, NextFunction } from "express";
import { pairDevice, getDevices, updateDevice, revokeDevice } from "../../shared/devices";
import { authenticate } from "../middleware/auth";

const router = Router();

router.post("/pair", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const device = await pairDevice(req.body);
    res.status(201).json({
      code: "DEVICE_PARED",
      data: { device },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const devices = await getDevices(req.user!.id);
    res.json({
      code: "DEVICES_FETCHED",
      data: { devices },
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const device = await updateDevice(req.user!.id, req.params.id, req.body);
    res.json({
      code: "DEVICE_UPDATED",
      data: { device },
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await revokeDevice(req.user!.id, req.params.id);
    res.json({
      code: "DEVICE_REVOKED",
    });
  } catch (error) {
    next(error);
  }
});

export default router;