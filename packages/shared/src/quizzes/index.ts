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

export interface GeneratedQuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string | null;
}

export async function createQuiz(
  userId: string,
  data: {
    subject: string;
    topic: string;
    questionCount: number;
    title?: string;
    description?: string;
  },
  questions: GeneratedQuizQuestion[]
) {
  if (questions.length !== data.questionCount) {
    throw new Error("QUIZ_QUESTION_COUNT_MISMATCH");
  }

  const quiz = await prisma.quiz.create({
    data: {
      userId,
      title: data.title?.trim() || `${data.topic} Quiz`,
      description:
        data.description?.trim() ||
        `Generated ${data.questionCount} questions about ${data.topic}`,
      subject: data.subject,
      topic: data.topic,
      questionCount: data.questionCount,
      questions: {
        create: questions.map(item => ({
          question: item.question,
          options: item.options,
          correctAnswer: item.correctAnswer,
          explanation: item.explanation ?? null,
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

  return { quiz, generatedAt: new Date() };
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

  const seen = new Set<string>();
  for (const answer of data.answers) {
    if (seen.has(answer.questionId)) {
      throw new Error("QUIZ_DUPLICATE_ANSWER");
    }
    seen.add(answer.questionId);
    if (!quiz.questions.some(question => question.id === answer.questionId)) {
      throw new Error("QUIZ_QUESTION_NOT_FOUND");
    }
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
export async function getQuizAttempts(
  userId: string,
  quizId?: string,
  limit = 20
) {
  return prisma.quizAttempt.findMany({
    where: {
      userId,
      ...(quizId ? { quizId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(100, Math.max(1, limit)),
    select: {
      id: true,
      userId: true,
      quizId: true,
      score: true,
      answeredAt: true,
      results: true,
      createdAt: true,
    },
  });
}
