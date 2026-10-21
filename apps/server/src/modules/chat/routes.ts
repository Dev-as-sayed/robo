import { Router } from "express";
import {
  chatConversationParamSchema,
  chatConversationQuerySchema,
  chatMessageQuerySchema,
  chatMessageSchema,
} from "@robo/shared/schemas";
import { getConversation, listConversations } from "@robo/shared/chat";
import { sendChatMessage } from "../ai/chat-service";
import { asyncHandler } from "../../http/async-handler";
import { sendSuccess } from "../../http/response";
import { aiMessageLimiter } from "../../middleware/ai-rate-limit";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";

const router = Router();

router.post(
  "/messages",
  authenticate,
  aiMessageLimiter,
  validate({ body: chatMessageSchema }),
  asyncHandler(async (req, res) => {
    const result = await sendChatMessage(req.user!.id, req.body);
    sendSuccess(res, {
      status: 201,
      code: "CHAT_MESSAGE_SENT",
      message: "Assistant replied successfully",
      data: result,
    });
  })
);

router.get(
  "/conversations",
  authenticate,
  validate({ query: chatConversationQuerySchema }),
  asyncHandler(async (req, res) => {
    const conversations = await listConversations(
      req.user!.id,
      Number(req.query.limit)
    );
    sendSuccess(res, {
      code: "CONVERSATIONS_FETCHED",
      data: { conversations },
    });
  })
);

router.get(
  "/conversations/:id",
  authenticate,
  validate({
    params: chatConversationParamSchema,
    query: chatMessageQuerySchema,
  }),
  asyncHandler(async (req, res) => {
    const conversation = await getConversation(
      req.user!.id,
      req.params.id,
      Number(req.query.limit)
    );
    sendSuccess(res, {
      code: "CONVERSATION_FETCHED",
      data: { conversation },
    });
  })
);

export default router;
