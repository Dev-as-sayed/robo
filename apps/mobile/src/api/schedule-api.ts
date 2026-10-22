import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithReauth } from "./base-query";
import type { ApiEnvelope, ScheduleEntry } from "@/types";

export interface CreateScheduleInput {
  title: string;
  description?: string;
  startAt: string;
  endAt?: string;
  allDay?: boolean;
  subject?: string;
  room?: string;
  teacher?: string;
}

export interface UpdateScheduleInput extends Partial<CreateScheduleInput> {
  id: string;
}

export interface AddExceptionInput {
  id: string;
  date: string;
  reason?: string;
}

export const scheduleApi = createApi({
  reducerPath: "scheduleApi",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["Schedule"],
  endpoints: builder => ({
    schedule: builder.query<ScheduleEntry[], void>({
      query: () => "/schedule",
      transformResponse: (response: ApiEnvelope<{ schedule: ScheduleEntry[] }>) =>
        response.data.schedule,
      providesTags: ["Schedule"],
    }),
    createSchedule: builder.mutation<ScheduleEntry, CreateScheduleInput>({
      query: body => ({ url: "/schedule", method: "POST", body }),
      transformResponse: (response: ApiEnvelope<{ schedule: ScheduleEntry }>) =>
        response.data.schedule,
      invalidatesTags: ["Schedule"],
    }),
    updateSchedule: builder.mutation<ScheduleEntry, UpdateScheduleInput>({
      query: ({ id, ...body }) => ({
        url: `/schedule/${id}`,
        method: "PATCH",
        body,
      }),
      transformResponse: (response: ApiEnvelope<{ schedule: ScheduleEntry }>) =>
        response.data.schedule,
      invalidatesTags: ["Schedule"],
    }),
    deleteSchedule: builder.mutation<void, string>({
      query: id => ({ url: `/schedule/${id}`, method: "DELETE" }),
      invalidatesTags: ["Schedule"],
    }),
    addException: builder.mutation<void, AddExceptionInput>({
      query: ({ id, ...body }) => ({
        url: `/schedule/${id}/exceptions`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Schedule"],
    }),
  }),
});

export const {
  useScheduleQuery,
  useCreateScheduleMutation,
  useUpdateScheduleMutation,
  useDeleteScheduleMutation,
  useAddExceptionMutation,
} = scheduleApi;
