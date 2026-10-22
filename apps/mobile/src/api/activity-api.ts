import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithReauth } from "./base-query";
import type { ActionLogEntry, ApiEnvelope } from "@/types";

export const activityApi = createApi({
  reducerPath: "activityApi",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["Activity"],
  endpoints: builder => ({
    actionLogs: builder.query<ActionLogEntry[], { limit?: number } | void>({
      query: filters => ({
        url: "/actions",
        params: { limit: filters?.limit ?? 50 },
      }),
      transformResponse: (
        response: ApiEnvelope<{ actions: ActionLogEntry[] }>
      ) => response.data.actions,
      providesTags: ["Activity"],
    }),
  }),
});

export const { useActionLogsQuery } = activityApi;
