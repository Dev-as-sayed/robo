import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithReauth } from "./base-query";
import type { ApiEnvelope } from "@/types";

export interface ExplainImageInput {
  imageBase64: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  question?: string;
}

export const visionApi = createApi({
  reducerPath: "visionApi",
  baseQuery: baseQueryWithReauth,
  endpoints: builder => ({
    explainImage: builder.mutation<string, ExplainImageInput>({
      query: body => ({ url: "/ai/vision", method: "POST", body }),
      transformResponse: (response: ApiEnvelope<{ answer: string }>) =>
        response.data.answer,
    }),
  }),
});

export const { useExplainImageMutation } = visionApi;
