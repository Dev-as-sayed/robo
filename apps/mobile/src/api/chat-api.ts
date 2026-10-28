import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithReauth } from "./base-query";
import type { ApiEnvelope, Conversation } from "@/types";

export type AiFeedbackReason =
  | "OFFENSIVE"
  | "UNSAFE"
  | "INCORRECT"
  | "OTHER";

export interface AiFeedbackInput {
  surface: "CHAT" | "VISION";
  reason: AiFeedbackReason;
  messageId?: string;
  responseText?: string;
  details?: string;
}

export const chatApi = createApi({
  reducerPath: "chatApi",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["Conversation"],
  endpoints: builder => ({
    conversation: builder.query<Conversation, string>({
      query: id => `/chat/conversations/${id}?limit=50`,
      transformResponse: (
        response: ApiEnvelope<{ conversation: Conversation }>
      ) => response.data.conversation,
      providesTags: (_result, _error, id) => [{ type: "Conversation", id }],
    }),
    submitAiFeedback: builder.mutation<{ id: string }, AiFeedbackInput>({
      query: body => ({ url: "/chat/feedback", method: "POST", body }),
      transformResponse: (
        response: ApiEnvelope<{ feedback: { id: string } }>
      ) => response.data.feedback,
    }),
  }),
});

export const { useConversationQuery, useSubmitAiFeedbackMutation } = chatApi;
