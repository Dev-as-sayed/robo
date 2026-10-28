import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  quiz: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
  quizAttempt: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
}));

const generateStructured = vi.hoisted(() => vi.fn());

vi.mock("@robo/shared/lib/prisma", () => ({ prisma: db }));
vi.mock("../src/modules/ai/structured", () => ({ generateStructured }));

const { generateQuizWithAi } = await import(
  "../src/modules/quizzes/generator"
);
const { getQuizAttempts, submitAttempt } = await import(
  "@robo/shared/quizzes"
);

const now = new Date("2026-10-23T12:00:00.000Z");

function generated(overrides: Record<string, unknown> = {}) {
  return {
    title: "Optics Quiz",
    description: "A short check",
    questions: [
      {
        question: "What does a prism do to white light?",
        options: ["Reflects it", "Disperses it", "Absorbs it", "Polarizes it"],
        correctAnswer: "disperses it",
        explanation: "Different wavelengths refract by different amounts.",
      },
      {
        question: "What is the unit of frequency?",
        options: ["Hertz", "Metre", "Newton", "Joule"],
        correctAnswer: "Hertz",
        explanation: "Frequency is measured in hertz.",
      },
    ],
    ...overrides,
  };
}

describe("quiz generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.quiz.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "quiz-1",
      userId: data.userId,
      title: data.title,
      description: data.description,
      subject: data.subject,
      topic: data.topic,
      questionCount: data.questionCount,
      questions: [
        { id: "q-1", question: "A", options: ["1", "2", "3", "4"], correctAnswer: "1" },
        { id: "q-2", question: "B", options: ["1", "2", "3", "4"], correctAnswer: "2" },
      ],
      createdAt: now,
    }));
  });

  it("normalizes the correct answer to the option text and persists", async () => {
    generateStructured.mockResolvedValue(generated());

    const result = await generateQuizWithAi("user-1", {
      subject: "Physics",
      topic: "Optics",
      questionCount: 2,
      difficulty: "medium",
    });

    expect(result.quiz.id).toBe("quiz-1");
    expect(db.quiz.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          subject: "Physics",
          topic: "Optics",
          questionCount: 2,
          questions: {
            create: [
              expect.objectContaining({ correctAnswer: "Disperses it" }),
              expect.objectContaining({ correctAnswer: "Hertz" }),
            ],
          },
        }),
      })
    );
  });

  it("retries when the first response breaks validation", async () => {
    generateStructured
      .mockResolvedValueOnce(
        generated({
          questions: [
            {
              question: "What does a prism do?",
              options: ["Same", "Same", "Other", "Last"],
              correctAnswer: "Same",
            },
            {
              question: "What is the unit of frequency?",
              options: ["Hertz", "Metre", "Newton", "Joule"],
              correctAnswer: "Hertz",
            },
          ],
        })
      )
      .mockResolvedValueOnce(generated());

    await generateQuizWithAi("user-1", {
      subject: "Physics",
      topic: "Optics",
      questionCount: 2,
    });

    expect(generateStructured).toHaveBeenCalledTimes(2);
    expect(db.quiz.create).toHaveBeenCalledTimes(1);
  });

  it("rejects a persistently wrong question count", async () => {
    generateStructured.mockResolvedValue(
      generated({ questions: generated().questions.slice(0, 1) })
    );

    await expect(
      generateQuizWithAi("user-1", {
        subject: "Physics",
        topic: "Optics",
        questionCount: 2,
      })
    ).rejects.toThrow("QUIZ_QUESTION_COUNT_MISMATCH");
    expect(db.quiz.create).not.toHaveBeenCalled();
  });
});

describe("quiz attempts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects duplicate answers and questions from another quiz", async () => {
    db.quiz.findFirst.mockResolvedValue({
      id: "quiz-1",
      userId: "user-1",
      questionCount: 2,
      questions: [
        { id: "q-1", correctAnswer: "A" },
        { id: "q-2", correctAnswer: "B" },
      ],
    });

    await expect(
      submitAttempt("user-1", "quiz-1", {
        answers: [
          { questionId: "q-1", selectedAnswer: "A" },
          { questionId: "q-1", selectedAnswer: "B" },
        ],
      })
    ).rejects.toThrow("QUIZ_DUPLICATE_ANSWER");

    await expect(
      submitAttempt("user-1", "quiz-1", {
        answers: [{ questionId: "q-9", selectedAnswer: "A" }],
      })
    ).rejects.toThrow("QUIZ_QUESTION_NOT_FOUND");
  });

  it("lists only the current user's attempts", async () => {
    db.quizAttempt.findMany.mockResolvedValue([]);

    await getQuizAttempts("user-1", "quiz-1", 500);

    expect(db.quizAttempt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", quizId: "quiz-1" },
        take: 100,
      })
    );
  });
});
