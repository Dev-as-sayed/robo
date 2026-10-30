import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithReauth } from "./base-query";
import type { ApiEnvelope, StudyDocument } from "@/types";

export interface UploadDocumentInput {
  uri: string;
  name: string;
  type: string;
  subject?: string;
}

export interface DocumentDownloadUrl {
  downloadUrl: string;
  expiresAt: string;
}

export const documentsApi = createApi({
  reducerPath: "documentsApi",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["Documents"],
  endpoints: builder => ({
    documents: builder.query<StudyDocument[], void>({
      query: () => "/documents",
      transformResponse: (response: ApiEnvelope<{ documents: StudyDocument[] }>) =>
        response.data.documents,
      providesTags: ["Documents"],
    }),
    uploadDocument: builder.mutation<StudyDocument, UploadDocumentInput>({
      query: ({ uri, name, type, subject }) => {
        const form = new FormData();
        form.append("file", { uri, name, type } as unknown as Blob);
        if (subject) {
          form.append("subject", subject);
        }

        return { url: "/documents/upload", method: "POST", body: form };
      },
      transformResponse: (response: ApiEnvelope<{ document: StudyDocument }>) =>
        response.data.document,
      invalidatesTags: ["Documents"],
    }),
    documentDownloadUrl: builder.mutation<DocumentDownloadUrl, string>({
      query: id => ({ url: `/documents/${id}/download-url`, method: "GET" }),
      transformResponse: (
        response: ApiEnvelope<DocumentDownloadUrl>
      ) => response.data,
    }),
    reindexDocument: builder.mutation<StudyDocument | null, string>({
      query: id => ({ url: `/documents/${id}/reindex`, method: "POST" }),
      transformResponse: (
        response: ApiEnvelope<{ document: StudyDocument | null }>
      ) => response.data.document,
      invalidatesTags: ["Documents"],
    }),
    deleteDocument: builder.mutation<void, string>({
      query: id => ({ url: `/documents/${id}`, method: "DELETE" }),
      invalidatesTags: ["Documents"],
    }),
  }),
});

export const {
  useDocumentsQuery,
  useUploadDocumentMutation,
  useDocumentDownloadUrlMutation,
  useReindexDocumentMutation,
  useDeleteDocumentMutation,
} = documentsApi;
