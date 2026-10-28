import { Router } from "express";
import {
  createMemorySchema,
  memoryQuerySchema,
  updateMemorySchema,
} from "@robo/shared/schemas";
import {
  createMemory,
  deleteMemory,
  listMemories,
  updateMemory,
} from "@robo/shared/memories";
import { asyncHandler } from "../../http/async-handler";
import { sendSuccess } from "../../http/response";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";

const router = Router();

router.get(
  "/",
  authenticate,
  validate({ query: memoryQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = req.query as { category?: string; limit?: number };
    const memories = await listMemories(req.user!.id, {
      category: query.category as never,
      limit: query.limit,
    });
    sendSuccess(res, { code: "MEMORIES_FETCHED", data: { memories } });
  })
);

router.post(
  "/",
  authenticate,
  validate({ body: createMemorySchema }),
  asyncHandler(async (req, res) => {
    const memory = await createMemory(req.user!.id, req.body);
    sendSuccess(res, {
      status: 201,
      code: "MEMORY_CREATED",
      message: "Memory saved",
      data: { memory },
    });
  })
);

router.patch(
  "/:id",
  authenticate,
  validate({ body: updateMemorySchema }),
  asyncHandler(async (req, res) => {
    const memory = await updateMemory(req.user!.id, req.params.id, req.body);
    sendSuccess(res, {
      code: "MEMORY_UPDATED",
      message: "Memory updated",
      data: { memory },
    });
  })
);

router.delete(
  "/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    await deleteMemory(req.user!.id, req.params.id);
    sendSuccess(res, { code: "MEMORY_DELETED", message: "Memory forgotten" });
  })
);

export default router;
