import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithReauth } from "./base-query";
import type { ApiEnvelope, Memory, MemoryCategory } from "@/types";

export interface CreateMemoryInput {
  content: string;
  category?: MemoryCategory;
}

export interface UpdateMemoryInput extends CreateMemoryInput {
  id: string;
}

export const memoriesApi = createApi({
  reducerPath: "memoriesApi",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["Memories"],
  endpoints: builder => ({
    memories: builder.query<Memory[], { category?: MemoryCategory } | void>({
      query: filters => ({
        url: "/memories",
        ...(filters?.category ? { params: { category: filters.category } } : {}),
      }),
      transformResponse: (response: ApiEnvelope<{ memories: Memory[] }>) =>
        response.data.memories,
      providesTags: ["Memories"],
    }),
    createMemory: builder.mutation<Memory, CreateMemoryInput>({
      query: body => ({ url: "/memories", method: "POST", body }),
      transformResponse: (response: ApiEnvelope<{ memory: Memory }>) =>
        response.data.memory,
      invalidatesTags: ["Memories"],
    }),
    updateMemory: builder.mutation<Memory, UpdateMemoryInput>({
      query: ({ id, ...body }) => ({
        url: `/memories/${id}`,
        method: "PATCH",
        body,
      }),
      transformResponse: (response: ApiEnvelope<{ memory: Memory }>) =>
        response.data.memory,
      invalidatesTags: ["Memories"],
    }),
    deleteMemory: builder.mutation<void, string>({
      query: id => ({ url: `/memories/${id}`, method: "DELETE" }),
      invalidatesTags: ["Memories"],
    }),
  }),
});

export const {
  useMemoriesQuery,
  useCreateMemoryMutation,
  useUpdateMemoryMutation,
  useDeleteMemoryMutation,
} = memoriesApi;
