import { prisma } from "../lib/prisma";

export interface Quiz {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  subject: string | null;
  topic: string | null;
  questionCount: number;
  questions: QuizQuestion[];
  createdAt: Date;
  updatedAt: Date;
}

export interface QuizQuestion {
  id: string;
  quizId: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string | null;
}

export interface QuizAttempt {
  id: string;
  userId: string;
  quizId: string;
  score: number | null;
  answeredAt: Date | null;
  results: QuizAttemptResult[];
}

export interface QuizAttemptResult {
  questionId: string;
  selectedAnswer: string;
  isCorrect: boolean;
}

export async function generateQuiz(userId: string, data: {
  subject: string;
  topic: string;
  questionCount: number;
  difficulty?: "easy" | "medium" | "hard";
}) {
  // For now, create a basic quiz structure
  // In production, this would call an LLM to generate questions
  const quiz = await prisma.quiz.create({
    data: {
      userId,
      title: `${data.topic} Quiz`,
      description: `Generated ${data.questionCount} questions about ${data.topic}`,
      subject: data.subject,
      topic: data.topic,
      questionCount: data.questionCount,
      questions: {
        create: Array.from({ length: data.questionCount }).map((_, i) => ({
          question: `Question ${i + 1} about ${data.topic}`,
          options: [
            `Option A for question ${i + 1}`,
            `Option B for question ${i + 1}`,
            `Option C for question ${i + 1}`,
            `Option D for question ${i + 1}`,
          ],
          correctAnswer: `Option A`,
          explanation: `Explanation for question ${i + 1}`,
        })),
      },
    },
    select: {
      id: true,
      userId: true,
      title: true,
      description: true,
      subject: true,
      topic: true,
      questionCount: true,
      questions: {
        select: {
          id: true,
          question: true,
          options: true,
          correctAnswer: true,
          explanation: true,
        },
      },
      createdAt: true,
    },
  });

  return {
    quiz,
    generatedAt: new Date(),
  };
}

export async function getQuizzes(userId: string) {
  return await prisma.quiz.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      userId: true,
      title: true,
      description: true,
      subject: true,
      topic: true,
      questionCount: true,
      createdAt: true,
    },
  });
}

export async function getQuiz(userId: string, quizId: string) {
  return await prisma.quiz.findFirst({
    where: { id: quizId, userId },
    include: {
      questions: {
        select: {
          id: true,
          question: true,
          options: true,
          correctAnswer: true,
          explanation: true,
        },
      },
    },
  });
}

export async function submitAttempt(userId: string, quizId: string, data: {
  answers: { questionId: string; selectedAnswer: string }[];
}) {
  const quiz = await getQuiz(userId, quizId);

  if (!quiz) {
    throw new Error("QUIZ_NOT_FOUND");
  }

  const results = data.answers.map((answer) => {
    const question = quiz.questions.find((q: any) => q.id === answer.questionId);
    if (!question) {
      return { questionId: answer.questionId, selectedAnswer: answer.selectedAnswer, isCorrect: false };
    }
    const isCorrect = question.correctAnswer === answer.selectedAnswer;
    return { questionId: answer.questionId, selectedAnswer: answer.selectedAnswer, isCorrect };
  });

  const correctCount = results.filter((r: any) => r.isCorrect).length;
  const score = quiz.questionCount > 0 ? Math.round((correctCount / quiz.questionCount) * 100) : 0;

  return await prisma.quizAttempt.create({
    data: {
      userId,
      quizId,
      score,
      answeredAt: new Date(),
      results,
    },
    select: {
      id: true,
      userId: true,
      quizId: true,
      score: true,
      answeredAt: true,
      results: true,
    },
  });
}