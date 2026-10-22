import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithReauth } from "./base-query";
import type { ApiEnvelope, Conversation } from "@/types";

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
  }),
});

export const { useConversationQuery } = chatApi;
