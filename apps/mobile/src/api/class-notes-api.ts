import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithReauth } from "./base-query";
import type { ApiEnvelope, ClassNote } from "@/types";

export interface CreateClassNoteInput {
  title: string;
  content: string;
  subject?: string;
  classAt?: string;
  scheduleEntryId?: string;
}

export interface ClassNoteFilters {
  subject?: string;
  search?: string;
  from?: string;
  to?: string;
}

export const classNotesApi = createApi({
  reducerPath: "classNotesApi",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["ClassNotes"],
  endpoints: builder => ({
    classNotes: builder.query<ClassNote[], ClassNoteFilters | void>({
      query: filters => ({
        url: "/class-notes",
        ...(filters
          ? {
              params: Object.fromEntries(
                Object.entries(filters).filter(([, value]) => Boolean(value))
              ),
            }
          : {}),
      }),
      transformResponse: (response: ApiEnvelope<{ notes: ClassNote[] }>) =>
        response.data.notes,
      providesTags: ["ClassNotes"],
    }),
    createClassNote: builder.mutation<ClassNote, CreateClassNoteInput>({
      query: body => ({ url: "/class-notes", method: "POST", body }),
      transformResponse: (response: ApiEnvelope<{ note: ClassNote }>) =>
        response.data.note,
      invalidatesTags: ["ClassNotes"],
    }),
    deleteClassNote: builder.mutation<void, string>({
      query: id => ({ url: `/class-notes/${id}`, method: "DELETE" }),
      invalidatesTags: ["ClassNotes"],
    }),
  }),
});

export const {
  useClassNotesQuery,
  useCreateClassNoteMutation,
  useDeleteClassNoteMutation,
} = classNotesApi;
