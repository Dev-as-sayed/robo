import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithReauth } from "./base-query";
import type { ApiEnvelope, StudySessionResult } from "@/types";

export const sessionsApi = createApi({
  reducerPath: "sessionsApi",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["StudySession"],
  endpoints: builder => ({
    activeSession: builder.query<StudySessionResult | null, void>({
      query: () => "/sessions/active",
      transformResponse: (response: ApiEnvelope<{ session: StudySessionResult | null }>) =>
        response.data.session,
      providesTags: ["StudySession"],
    }),
    sessions: builder.query<StudySessionResult[], void>({
      query: () => "/sessions",
      transformResponse: (response: ApiEnvelope<{ sessions: StudySessionResult[] }>) =>
        response.data.sessions,
      providesTags: ["StudySession"],
    }),
    startSession: builder.mutation<
      StudySessionResult,
      { subject?: string; plannedMinutes?: number }
    >({
      query: body => ({ url: "/sessions/start", method: "POST", body }),
      transformResponse: (response: ApiEnvelope<StudySessionResult>) => response.data,
      invalidatesTags: ["StudySession"],
    }),
    pauseSession: builder.mutation<StudySessionResult, string>({
      query: id => ({ url: `/sessions/${id}/pause`, method: "POST" }),
      transformResponse: (response: ApiEnvelope<StudySessionResult>) => response.data,
      invalidatesTags: ["StudySession"],
    }),
    resumeSession: builder.mutation<StudySessionResult, string>({
      query: id => ({ url: `/sessions/${id}/resume`, method: "POST" }),
      transformResponse: (response: ApiEnvelope<StudySessionResult>) => response.data,
      invalidatesTags: ["StudySession"],
    }),
    extendSession: builder.mutation<StudySessionResult, { id: string; minutes: number }>({
      query: ({ id, minutes }) => ({
        url: `/sessions/${id}/extend`,
        method: "POST",
        body: { minutes },
      }),
      transformResponse: (response: ApiEnvelope<StudySessionResult>) => response.data,
      invalidatesTags: ["StudySession"],
    }),
    endSession: builder.mutation<StudySessionResult, string>({
      query: id => ({ url: `/sessions/${id}/end`, method: "POST" }),
      transformResponse: (response: ApiEnvelope<StudySessionResult>) => response.data,
      invalidatesTags: ["StudySession"],
    }),
  }),
});

export const {
  useActiveSessionQuery,
  useSessionsQuery,
  useStartSessionMutation,
  usePauseSessionMutation,
  useResumeSessionMutation,
  useExtendSessionMutation,
  useEndSessionMutation,
} = sessionsApi;
