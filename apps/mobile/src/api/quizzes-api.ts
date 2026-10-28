import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithReauth } from "./base-query";
import type {
  ApiEnvelope,
  Quiz,
  QuizAttempt,
  QuizGenerationResult,
  QuizSummary,
} from "@/types";

export interface GenerateQuizInput {
  subject: string;
  topic: string;
  questionCount: number;
  difficulty?: "easy" | "medium" | "hard";
}

export interface SubmitQuizInput {
  quizId: string;
  answers: { questionId: string; selectedAnswer: string }[];
}

export const quizzesApi = createApi({
  reducerPath: "quizzesApi",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["Quizzes", "QuizAttempts"],
  endpoints: builder => ({
    quizzes: builder.query<QuizSummary[], void>({
      query: () => "/quizzes",
      transformResponse: (response: ApiEnvelope<{ quizzes: QuizSummary[] }>) =>
        response.data.quizzes,
      providesTags: ["Quizzes"],
    }),
    quiz: builder.query<Quiz, string>({
      query: id => `/quizzes/${id}`,
      transformResponse: (response: ApiEnvelope<{ quiz: Quiz }>) =>
        response.data.quiz,
      providesTags: (_result, _error, id) => [{ type: "Quizzes", id }],
    }),
    generateQuiz: builder.mutation<QuizGenerationResult, GenerateQuizInput>({
      query: body => ({ url: "/quizzes/generate", method: "POST", body }),
      transformResponse: (
        response: ApiEnvelope<{ quiz: Quiz; generatedAt: string }>
      ) => ({
        quiz: response.data.quiz,
        generatedAt: response.data.generatedAt,
      }),
      invalidatesTags: ["Quizzes"],
    }),
    submitQuiz: builder.mutation<QuizAttempt, SubmitQuizInput>({
      query: ({ quizId, answers }) => ({
        url: `/quizzes/${quizId}/attempts`,
        method: "POST",
        body: { answers },
      }),
      transformResponse: (response: ApiEnvelope<{ attempt: QuizAttempt }>) =>
        response.data.attempt,
      invalidatesTags: ["QuizAttempts"],
    }),
    quizAttempts: builder.query<QuizAttempt[], string>({
      query: quizId => `/quizzes/${quizId}/attempts`,
      transformResponse: (
        response: ApiEnvelope<{ attempts: QuizAttempt[] }>
      ) => response.data.attempts,
      providesTags: ["QuizAttempts"],
    }),
  }),
});

export const {
  useQuizzesQuery,
  useQuizQuery,
  useGenerateQuizMutation,
  useSubmitQuizMutation,
  useQuizAttemptsQuery,
} = quizzesApi;
