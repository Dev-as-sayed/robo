import { z } from "zod";
import { createQuiz } from "@robo/shared/quizzes";
import { generateStructured } from "../ai/structured";
import { toProviderError } from "../ai/provider-errors";

const generatedQuizSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500).optional(),
  questions: z
    .array(
      z.object({
        question: z.string().trim().min(5).max(1000),
        options: z.array(z.string().trim().min(1).max(300)).length(4),
        correctAnswer: z.string().trim().min(1).max(300),
        explanation: z.string().trim().max(1000).optional(),
      })
    )
    .min(1)
    .max(20),
});

export interface QuizGenerationInput {
  subject: string;
  topic: string;
  questionCount: number;
  difficulty?: "easy" | "medium" | "hard";
}

function normalizeQuestions(
  generated: z.infer<typeof generatedQuizSchema>,
  expectedCount: number
): { title: string; description?: string; questions: { question: string; options: string[]; correctAnswer: string; explanation?: string }[] } {
  if (generated.questions.length !== expectedCount) {
    throw new Error("QUIZ_QUESTION_COUNT_MISMATCH");
  }

  const questions = generated.questions.map((item, index) => {
    const options = item.options.map(option => option.trim());
    if (new Set(options).size !== options.length) {
      throw new Error(`QUIZ_DUPLICATE_OPTIONS:${index}`);
    }

    const correctAnswer = options.find(
      option => option.toLowerCase() === item.correctAnswer.trim().toLowerCase()
    );
    if (!correctAnswer) {
      throw new Error(`QUIZ_ANSWER_NOT_IN_OPTIONS:${index}`);
    }

    return {
      question: item.question.trim(),
      options,
      correctAnswer,
      ...(item.explanation ? { explanation: item.explanation.trim() } : {}),
    };
  });

  return {
    title: generated.title.trim(),
    ...(generated.description ? { description: generated.description.trim() } : {}),
    questions,
  };
}

function buildPrompt(input: QuizGenerationInput, strict: boolean): string {
  return [
    `Create a ${input.difficulty ?? "medium"} multiple-choice quiz about ${input.topic} in ${input.subject}.`,
    `Return exactly ${input.questionCount} questions with exactly four distinct options each.`,
    "Exactly one option must be the correct answer, and correctAnswer must match that option text exactly.",
    "Include a short explanation for each answer. Avoid trick questions and ambiguous wording.",
    strict
      ? "The previous attempt was invalid. Double-check the question count, unique options and answer matching."
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateQuizWithAi(userId: string, input: QuizGenerationInput) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const generated = await generateStructured(
        generatedQuizSchema,
        buildPrompt(input, attempt > 0)
      );
      const normalized = normalizeQuestions(generated, input.questionCount);
      return await createQuiz(
        userId,
        {
          subject: input.subject,
          topic: input.topic,
          questionCount: input.questionCount,
          title: normalized.title,
          ...(normalized.description
            ? { description: normalized.description }
            : {}),
        },
        normalized.questions
      );
    } catch (error) {
      lastError = error;
    }
  }

  if (
    lastError instanceof Error &&
    (lastError.message.startsWith("QUIZ_") || lastError.message.startsWith("AI_"))
  ) {
    throw lastError;
  }

  throw toProviderError(lastError);
}
