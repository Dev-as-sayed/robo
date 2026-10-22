import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithReauth } from "./base-query";
import type { ApiEnvelope, DataExport } from "@/types";

export const accountApi = createApi({
  reducerPath: "accountApi",
  baseQuery: baseQueryWithReauth,
  endpoints: builder => ({
    exportData: builder.mutation<DataExport, void>({
      query: () => ({ url: "/users/me/export", method: "POST" }),
      transformResponse: (response: ApiEnvelope<DataExport>) => response.data,
    }),
    deleteAccount: builder.mutation<{ deleted: boolean }, void>({
      query: () => ({ url: "/users/me", method: "DELETE" }),
      transformResponse: (response: ApiEnvelope<{ deleted: boolean }>) =>
        response.data,
    }),
  }),
});

export const { useExportDataMutation, useDeleteAccountMutation } = accountApi;
