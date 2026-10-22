import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithReauth } from "./base-query";
import type { LoginInput, RegisterInput } from "@/schemas";
import type {
  AccountPreferences,
  ApiEnvelope,
  AuthResult,
  User,
} from "@/types";

export const authApi = createApi({
  reducerPath: "authApi",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["Me"],
  endpoints: builder => ({
    login: builder.mutation<AuthResult, LoginInput>({
      query: body => ({ url: "/auth/login", method: "POST", body }),
      transformResponse: (response: ApiEnvelope<AuthResult>) => response.data,
    }),
    register: builder.mutation<AuthResult, RegisterInput>({
      query: body => ({ url: "/auth/register", method: "POST", body }),
      transformResponse: (response: ApiEnvelope<AuthResult>) => response.data,
    }),
    logout: builder.mutation<void, { refreshToken: string }>({
      query: body => ({ url: "/auth/logout", method: "POST", body }),
    }),
    me: builder.query<User, void>({
      query: () => "/users/me",
      transformResponse: (response: ApiEnvelope<{ user: User }>) =>
        response.data.user,
      providesTags: ["Me"],
    }),
    updateMe: builder.mutation<User, AccountPreferences>({
      query: body => ({ url: "/users/me", method: "PATCH", body }),
      transformResponse: (response: ApiEnvelope<{ user: User }>) =>
        response.data.user,
      invalidatesTags: ["Me"],
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
  useMeQuery,
  useUpdateMeMutation,
} = authApi;
