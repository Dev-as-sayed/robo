import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithReauth } from "./base-query";
import type {
  ApiEnvelope,
  Exam,
  ExamStatus,
  PlanGenerationResult,
  PlanRecalculation,
  Readiness,
  RevisionSummary,
} from "@/types";

export interface CreateExamInput {
  subject: string;
  date: string;
  topics?: string[];
  weight?: number;
}

export interface UpdateExamInput extends Partial<CreateExamInput> {
  id: string;
  status?: ExamStatus;
}

export interface GeneratePlanInput {
  examId: string;
  dailyLimit?: number;
  includeReviews?: boolean;
}

export const examsApi = createApi({
  reducerPath: "examsApi",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["Exams", "Readiness"],
  endpoints: builder => ({
    exams: builder.query<Exam[], { status?: ExamStatus } | void>({
      query: filters => ({
        url: "/exams",
        ...(filters?.status ? { params: { status: filters.status } } : {}),
      }),
      transformResponse: (response: ApiEnvelope<{ exams: Exam[] }>) =>
        response.data.exams,
      providesTags: ["Exams"],
    }),
    exam: builder.query<Exam, string>({
      query: id => `/exams/${id}`,
      transformResponse: (response: ApiEnvelope<{ exam: Exam }>) =>
        response.data.exam,
      providesTags: (_result, _error, id) => [{ type: "Exams", id }],
    }),
    createExam: builder.mutation<Exam, CreateExamInput>({
      query: body => ({ url: "/exams", method: "POST", body }),
      transformResponse: (response: ApiEnvelope<{ exam: Exam }>) =>
        response.data.exam,
      invalidatesTags: ["Exams"],
    }),
    updateExam: builder.mutation<Exam, UpdateExamInput>({
      query: ({ id, ...body }) => ({ url: `/exams/${id}`, method: "PATCH", body }),
      transformResponse: (response: ApiEnvelope<{ exam: Exam }>) =>
        response.data.exam,
      invalidatesTags: ["Exams"],
    }),
    deleteExam: builder.mutation<void, string>({
      query: id => ({ url: `/exams/${id}`, method: "DELETE" }),
      invalidatesTags: ["Exams"],
    }),
    generatePlan: builder.mutation<PlanGenerationResult, GeneratePlanInput>({
      query: ({ examId, ...body }) => ({
        url: `/exams/${examId}/plan`,
        method: "POST",
        body,
      }),
      transformResponse: (response: ApiEnvelope<{ plan: PlanGenerationResult }>) =>
        response.data.plan,
      invalidatesTags: ["Exams", "Readiness"],
    }),
    // The server's approve route takes the plan id, not the exam id.
    approvePlan: builder.mutation<void, string>({
      query: planId => ({ url: `/exams/${planId}/plan/approve`, method: "POST" }),
      invalidatesTags: ["Exams", "Readiness"],
    }),
    recalculatePlan: builder.mutation<PlanRecalculation, string>({
      query: examId => ({
        url: `/exams/${examId}/plan/recalculate`,
        method: "POST",
      }),
      transformResponse: (response: ApiEnvelope<{ result: PlanRecalculation }>) =>
        response.data.result,
      invalidatesTags: ["Exams", "Readiness"],
    }),
    revisionSummary: builder.query<RevisionSummary, string>({
      query: examId => `/exams/${examId}/revision`,
      transformResponse: (
        response: ApiEnvelope<{ summary: RevisionSummary }>
      ) => response.data.summary,
    }),
    readiness: builder.query<Readiness, string>({
      query: examId => `/exams/${examId}/readiness`,
      transformResponse: (response: ApiEnvelope<{ readiness: Readiness }>) =>
        response.data.readiness,
      providesTags: (_result, _error, examId) => [
        { type: "Readiness", id: examId },
      ],
    }),
  }),
});

export const {
  useExamsQuery,
  useExamQuery,
  useCreateExamMutation,
  useUpdateExamMutation,
  useDeleteExamMutation,
  useGeneratePlanMutation,
  useApprovePlanMutation,
  useRecalculatePlanMutation,
  useReadinessQuery,
  useLazyReadinessQuery,
  useLazyRevisionSummaryQuery,
} = examsApi;
