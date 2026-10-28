import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithReauth } from "./base-query";
import type { ApiEnvelope } from "@/types";

export interface PushTokenSummary {
  id: string;
  platform: "ios" | "android";
  preview: string;
  createdAt: string;
  updatedAt: string;
}

interface RegisterPushTokenInput {
  token: string;
  platform: "ios" | "android";
}

export const notificationsApi = createApi({
  reducerPath: "notificationsApi",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["PushTokens"],
  endpoints: builder => ({
    pushTokens: builder.query<PushTokenSummary[], void>({
      query: () => "/users/me/push-tokens",
      transformResponse: (response: ApiEnvelope<{ pushTokens: PushTokenSummary[] }>) =>
        response.data.pushTokens,
      providesTags: ["PushTokens"],
    }),
    registerPushToken: builder.mutation<PushTokenSummary, RegisterPushTokenInput>({
      query: body => ({ url: "/users/me/push-token", method: "POST", body }),
      transformResponse: (response: ApiEnvelope<{ pushToken: PushTokenSummary }>) =>
        response.data.pushToken,
      invalidatesTags: ["PushTokens"],
    }),
    revokePushToken: builder.mutation<{ revoked: boolean }, string>({
      query: id => ({ url: `/users/me/push-token/${id}`, method: "DELETE" }),
      invalidatesTags: ["PushTokens"],
    }),
  }),
});

export const {
  usePushTokensQuery,
  useRegisterPushTokenMutation,
  useRevokePushTokenMutation,
} = notificationsApi;
