import { Router } from "express";
import {
  aiFeedbackSchema,
  chatConversationParamSchema,
  chatConversationQuerySchema,
  chatMessageQuerySchema,
  chatMessageSchema,
} from "@robo/shared/schemas";
import { getConversation, listConversations } from "@robo/shared/chat";
import { sendChatMessage, streamChatMessage } from "../ai/chat-service";
import { createAiFeedback } from "./feedback";
import { asyncHandler } from "../../http/async-handler";
import { sendSuccess } from "../../http/response";
import { formatSseEvent, openSse } from "../../http/sse";
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

router.post(
  "/messages/stream",
  authenticate,
  aiMessageLimiter,
  validate({ body: chatMessageSchema }),
  asyncHandler(async (req, res) => {
    openSse(res);

    const abort = new AbortController();
    let closed = false;
    res.on("close", () => {
      if (!res.writableEnded) {
        closed = true;
        abort.abort();
      }
    });

    const emit = (event: string, data: unknown): void => {
      if (!closed && !res.writableEnded) {
        res.write(formatSseEvent(event, data));
      }
    };

    try {
      const result = await streamChatMessage(
        req.user!.id,
        req.body,
        token => emit("token", { token }),
        abort.signal
      );

      emit("done", {
        conversation: result.conversation,
        userMessage: result.userMessage,
        assistantMessage: result.assistantMessage,
        toolCallCount: result.toolCallCount,
      });
    } catch (error) {
      if (!closed && !abort.signal.aborted) {
        emit("error", {
          code: error instanceof Error ? error.message : "INTERNAL_ERROR",
          message: "The AI response stream failed",
        });
      }
    } finally {
      if (!res.writableEnded) {
        res.end();
      }
    }
  })
);

router.post(
  "/feedback",
  authenticate,
  aiMessageLimiter,
  validate({ body: aiFeedbackSchema }),
  asyncHandler(async (req, res) => {
    const feedback = await createAiFeedback(req.user!.id, req.body);
    sendSuccess(res, {
      status: 201,
      code: "AI_FEEDBACK_RECORDED",
      message: "Feedback recorded",
      data: { feedback },
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
