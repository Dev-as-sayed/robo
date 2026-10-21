import { Router } from "express";
import { createTodoSchema, updateTodoSchema } from "@robo/shared/schemas";
import {
  completeTodo,
  createTodo,
  deleteTodo,
  getTodos,
  updateTodo,
} from "@robo/shared/todos";
import { asyncHandler } from "../../http/async-handler";
import { sendSuccess } from "../../http/response";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";

const router = Router();

router.post(
  "/",
  authenticate,
  validate({ body: createTodoSchema }),
  asyncHandler(async (req, res) => {
    const todo = await createTodo(req.user!.id, req.body);
    sendSuccess(res, {
      status: 201,
      code: "TODO_CREATED",
      message: "Todo created successfully",
      data: { todo },
    });
  })
);

router.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const todos = await getTodos(req.user!.id, {
      status: req.query.status as string | undefined,
      subject: req.query.subject as string | undefined,
      dueBefore: req.query.dueBefore as string | undefined,
    });
    sendSuccess(res, { code: "TODOS_FETCHED", data: { todos } });
  })
);

router.patch(
  "/:id",
  authenticate,
  validate({ body: updateTodoSchema }),
  asyncHandler(async (req, res) => {
    const todo = await updateTodo(req.user!.id, req.params.id, req.body);
    sendSuccess(res, {
      code: "TODO_UPDATED",
      message: "Todo updated successfully",
      data: { todo },
    });
  })
);

router.delete(
  "/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    await deleteTodo(req.user!.id, req.params.id);
    sendSuccess(res, { code: "TODO_DELETED", message: "Todo deleted successfully" });
  })
);

router.post(
  "/:id/complete",
  authenticate,
  asyncHandler(async (req, res) => {
    const todo = await completeTodo(req.user!.id, req.params.id);
    sendSuccess(res, {
      code: "TODO_COMPLETED",
      message: "Todo completed successfully",
      data: { todo },
    });
  })
);

export default router;
