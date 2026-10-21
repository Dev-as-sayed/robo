import { Router } from "express";
import { deviceParamSchema, pairDeviceSchema, updateDeviceSchema } from "@robo/shared/schemas";
import {
  createPairingCode,
  factoryResetDevice,
  getDevices,
  pairDevice,
  revokeDevice,
  updateDevice,
} from "@robo/shared/devices";
import { asyncHandler } from "../../http/async-handler";
import { sendSuccess } from "../../http/response";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";

const router = Router();

router.post(
  "/pairing-code",
  authenticate,
  asyncHandler(async (req, res) => {
    const pairingCode = await createPairingCode(req.user!.id);
    sendSuccess(res, {
      status: 201,
      code: "PAIRING_CODE_CREATED",
      message: "Pairing code created successfully",
      data: pairingCode,
    });
  })
);

router.post(
  "/pair",
  validate({ body: pairDeviceSchema }),
  asyncHandler(async (req, res) => {
    const result = await pairDevice(req.body);
    sendSuccess(res, {
      status: 201,
      code: "DEVICE_PAIRED",
      message: "Device paired successfully",
      data: result,
    });
  })
);

router.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const devices = await getDevices(req.user!.id);
    sendSuccess(res, { code: "DEVICES_FETCHED", data: { devices } });
  })
);

router.patch(
  "/:id",
  authenticate,
  validate({ params: deviceParamSchema, body: updateDeviceSchema }),
  asyncHandler(async (req, res) => {
    const device = await updateDevice(req.user!.id, req.params.id, req.body);
    sendSuccess(res, {
      code: "DEVICE_UPDATED",
      message: "Device updated successfully",
      data: { device },
    });
  })
);

router.post(
  "/:id/revoke",
  authenticate,
  validate({ params: deviceParamSchema }),
  asyncHandler(async (req, res) => {
    const device = await revokeDevice(req.user!.id, req.params.id);
    sendSuccess(res, {
      code: "DEVICE_REVOKED",
      message: "Device revoked successfully",
      data: { device },
    });
  })
);

router.delete(
  "/:id",
  authenticate,
  validate({ params: deviceParamSchema }),
  asyncHandler(async (req, res) => {
    const device = await revokeDevice(req.user!.id, req.params.id);
    sendSuccess(res, {
      code: "DEVICE_REVOKED",
      message: "Device revoked successfully",
      data: { device },
    });
  })
);

router.post(
  "/:id/factory-reset",
  authenticate,
  validate({ params: deviceParamSchema }),
  asyncHandler(async (req, res) => {
    const device = await factoryResetDevice(req.user!.id, req.params.id);
    sendSuccess(res, {
      code: "DEVICE_RESET",
      message: "Device reset successfully",
      data: { device },
    });
  })
);

export default router;
