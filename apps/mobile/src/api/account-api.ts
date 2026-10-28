import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithReauth } from "./base-query";
import type {
  ApiEnvelope,
  ConsentKind,
  ConsentRecord,
  DataExport,
} from "@/types";

export const accountApi = createApi({
  reducerPath: "accountApi",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["Consents"],
  endpoints: builder => ({
    consents: builder.query<ConsentRecord[], void>({
      query: () => "/users/me/consents",
      transformResponse: (
        response: ApiEnvelope<{ consents: ConsentRecord[] }>
      ) => response.data.consents,
      providesTags: ["Consents"],
    }),
    updateConsent: builder.mutation<
      ConsentRecord,
      { kind: ConsentKind; granted: boolean; source?: string }
    >({
      query: ({ kind, granted, source }) => ({
        url: `/users/me/consents/${kind}`,
        method: "PUT",
        body: { granted, ...(source ? { source } : {}) },
      }),
      transformResponse: (
        response: ApiEnvelope<{ consent: ConsentRecord }>
      ) => response.data.consent,
      invalidatesTags: ["Consents"],
    }),
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

export const {
  useConsentsQuery,
  useUpdateConsentMutation,
  useExportDataMutation,
  useDeleteAccountMutation,
} = accountApi;
