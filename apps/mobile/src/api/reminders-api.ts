import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithReauth } from "./base-query";
import type {
  ApiEnvelope,
  Reminder,
  ReminderChannel,
  ReminderStatus,
} from "@/types";

export interface CreateReminderInput {
  text: string;
  at?: string;
  rrule?: string;
  channels?: ReminderChannel[];
  linkedEntity?: "todo" | "exam" | "schedule";
}

export interface UpdateReminderInput {
  id: string;
  text?: string;
  at?: string;
  rrule?: string;
  channels?: ReminderChannel[];
  status?: ReminderStatus;
}

export const remindersApi = createApi({
  reducerPath: "remindersApi",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["Reminders"],
  endpoints: builder => ({
    reminders: builder.query<Reminder[], { status?: ReminderStatus } | void>({
      query: filters => ({
        url: "/reminders",
        ...(filters?.status ? { params: { status: filters.status } } : {}),
      }),
      transformResponse: (response: ApiEnvelope<{ reminders: Reminder[] }>) =>
        response.data.reminders,
      providesTags: ["Reminders"],
    }),
    createReminder: builder.mutation<Reminder, CreateReminderInput>({
      query: body => ({ url: "/reminders", method: "POST", body }),
      transformResponse: (response: ApiEnvelope<{ reminder: Reminder }>) =>
        response.data.reminder,
      invalidatesTags: ["Reminders"],
    }),
    updateReminder: builder.mutation<Reminder, UpdateReminderInput>({
      query: ({ id, ...body }) => ({
        url: `/reminders/${id}`,
        method: "PATCH",
        body,
      }),
      transformResponse: (response: ApiEnvelope<{ reminder: Reminder }>) =>
        response.data.reminder,
      invalidatesTags: ["Reminders"],
    }),
    snoozeReminder: builder.mutation<Reminder, string>({
      query: id => ({ url: `/reminders/${id}/snooze`, method: "POST" }),
      transformResponse: (response: ApiEnvelope<{ reminder: Reminder }>) =>
        response.data.reminder,
      invalidatesTags: ["Reminders"],
    }),
    deleteReminder: builder.mutation<void, string>({
      query: id => ({ url: `/reminders/${id}`, method: "DELETE" }),
      invalidatesTags: ["Reminders"],
    }),
  }),
});

export const {
  useRemindersQuery,
  useCreateReminderMutation,
  useUpdateReminderMutation,
  useSnoozeReminderMutation,
  useDeleteReminderMutation,
} = remindersApi;
