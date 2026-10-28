import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithReauth } from "./base-query";
import type { ApiEnvelope, PendingAction, PendingActionWithUri } from "@/types";

export const pendingActionsApi = createApi({
  reducerPath: "pendingActionsApi",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["PendingAction"],
  endpoints: builder => ({
    pendingActions: builder.query<PendingAction[], void>({
      query: () => "/actions/pending",
      transformResponse: (response: ApiEnvelope<{ actions: PendingAction[] }>) =>
        response.data.actions,
      providesTags: ["PendingAction"],
    }),
    confirmPendingAction: builder.mutation<PendingActionWithUri, string>({
      query: id => ({ url: `/actions/pending/${id}/confirm`, method: "POST" }),
      transformResponse: (response: ApiEnvelope<{ action: PendingActionWithUri }>) =>
        response.data.action,
      invalidatesTags: ["PendingAction"],
    }),
    rejectPendingAction: builder.mutation<PendingAction, string>({
      query: id => ({ url: `/actions/pending/${id}/reject`, method: "POST" }),
      transformResponse: (response: ApiEnvelope<{ action: PendingAction }>) =>
        response.data.action,
      invalidatesTags: ["PendingAction"],
    }),
  }),
});

export const {
  usePendingActionsQuery,
  useConfirmPendingActionMutation,
  useRejectPendingActionMutation,
} = pendingActionsApi;
