import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithReauth } from "./base-query";
import type { AnalyticsRange, AnalyticsSummary, ApiEnvelope } from "@/types";

export const analyticsApi = createApi({
  reducerPath: "analyticsApi",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["Analytics"],
  endpoints: builder => ({
    summary: builder.query<AnalyticsSummary, AnalyticsRange | void>({
      query: range => ({
        url: "/analytics/summary",
        params: { range: range ?? "week" },
      }),
      transformResponse: (response: ApiEnvelope<{ summary: AnalyticsSummary }>) =>
        response.data.summary,
      providesTags: ["Analytics"],
    }),
  }),
});

export const { useSummaryQuery } = analyticsApi;
