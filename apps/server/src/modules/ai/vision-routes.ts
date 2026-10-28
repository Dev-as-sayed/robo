import { Router } from "express";
import { explainImageSchema } from "@robo/shared/schemas";
import { asyncHandler } from "../../http/async-handler";
import { sendSuccess } from "../../http/response";
import { aiMessageLimiter } from "../../middleware/ai-rate-limit";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";
import { BadRequestError } from "../../errors/app-error";
import { explainImage, VISION_MAX_BYTES } from "./vision";
import { recordUsage, reserveQuota } from "./usage-guard";

const router = Router();

router.post(
  "/vision",
  authenticate,
  aiMessageLimiter,
  validate({ body: explainImageSchema }),
  asyncHandler(async (req, res) => {
    const body = req.body as typeof explainImageSchema._type;
    const decoded = Buffer.from(body.imageBase64, "base64");

    if (decoded.length === 0 || decoded.length > VISION_MAX_BYTES) {
      throw new BadRequestError(
        "The image must be smaller than 5 MB.",
        "IMAGE_TOO_LARGE"
      );
    }

    await reserveQuota(req.user!.id);
    const result = await explainImage(body);
    recordUsage(req.user!.id, result.usage as { input_tokens?: number; output_tokens?: number } | null);

    sendSuccess(res, {
      code: "IMAGE_EXPLAINED",
      message: "Image explained successfully",
      data: { answer: result.answer },
    });
  })
);

export default router;
