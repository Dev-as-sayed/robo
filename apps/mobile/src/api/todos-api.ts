import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithReauth } from "./base-query";
import type { ApiEnvelope, Todo, TodoPriority, TodoStatus } from "@/types";

export interface CreateTodoInput {
  title: string;
  due?: string;
  subject?: string;
  priority?: TodoPriority;
  notes?: string;
}

export interface UpdateTodoInput {
  id: string;
  title?: string;
  due?: string;
  subject?: string;
  priority?: TodoPriority;
  notes?: string;
  status?: TodoStatus;
}

export interface TodoFilters {
  status?: TodoStatus;
  subject?: string;
  dueBefore?: string;
}

export const todosApi = createApi({
  reducerPath: "todosApi",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["Todos"],
  endpoints: builder => ({
    todos: builder.query<Todo[], TodoFilters | void>({
      query: filters => ({
        url: "/todos",
        ...(filters ? { params: filters } : {}),
      }),
      transformResponse: (response: ApiEnvelope<{ todos: Todo[] }>) =>
        response.data.todos,
      providesTags: ["Todos"],
    }),
    createTodo: builder.mutation<Todo, CreateTodoInput>({
      query: body => ({ url: "/todos", method: "POST", body }),
      transformResponse: (response: ApiEnvelope<{ todo: Todo }>) =>
        response.data.todo,
      invalidatesTags: ["Todos"],
    }),
    updateTodo: builder.mutation<Todo, UpdateTodoInput>({
      query: ({ id, ...body }) => ({
        url: `/todos/${id}`,
        method: "PATCH",
        body,
      }),
      transformResponse: (response: ApiEnvelope<{ todo: Todo }>) =>
        response.data.todo,
      invalidatesTags: ["Todos"],
    }),
    completeTodo: builder.mutation<Todo, string>({
      query: id => ({ url: `/todos/${id}/complete`, method: "POST" }),
      transformResponse: (response: ApiEnvelope<{ todo: Todo }>) =>
        response.data.todo,
      invalidatesTags: ["Todos"],
    }),
    deleteTodo: builder.mutation<void, string>({
      query: id => ({ url: `/todos/${id}`, method: "DELETE" }),
      invalidatesTags: ["Todos"],
    }),
  }),
});

export const {
  useTodosQuery,
  useLazyTodosQuery,
  useCreateTodoMutation,
  useUpdateTodoMutation,
  useCompleteTodoMutation,
  useDeleteTodoMutation,
} = todosApi;
