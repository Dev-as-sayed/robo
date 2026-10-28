import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithReauth } from "./base-query";
import type { ApiEnvelope, Subject } from "@/types";

export const subjectsApi = createApi({
  reducerPath: "subjectsApi",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["Subject"],
  endpoints: builder => ({
    subjects: builder.query<Subject[], void>({
      query: () => "/subjects",
      transformResponse: (response: ApiEnvelope<{ subjects: Subject[] }>) =>
        response.data.subjects,
      providesTags: ["Subject"],
    }),
  }),
});

export const { useSubjectsQuery } = subjectsApi;
