import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { apiErrorMessage } from "@/api/errors";
import {
  useGenerateQuizMutation,
  useQuizAttemptsQuery,
  useQuizQuery,
  useQuizzesQuery,
  useSubmitQuizMutation,
} from "@/api/quizzes-api";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { OptionList } from "@/components/OptionList";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { TextField } from "@/components/TextField";
import type { Quiz, QuizAttempt, QuizSummary } from "@/types";
import { formatDayTime } from "@/lib/time";
import { colors, spacing } from "@/theme";

const difficultyOptions = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
] as const;

type Difficulty = (typeof difficultyOptions)[number]["value"];

function scoreTone(score: number | null): string {
  if (score === null) return "Not scored";
  if (score >= 80) return `${score}% · strong`;
  if (score >= 50) return `${score}% · keep practising`;
  return `${score}% · review the topic`;
}

function AttemptRow({ attempt }: { attempt: QuizAttempt }) {
  const correct = attempt.results.filter(result => result.isCorrect).length;

  return (
    <View style={styles.attemptRow}>
      <Text style={styles.attemptScore}>{scoreTone(attempt.score)}</Text>
      <Text style={styles.rowMeta}>
        {`${correct}/${attempt.results.length} correct · ${formatDayTime(
          attempt.answeredAt ?? new Date().toISOString()
        )}`}
      </Text>
    </View>
  );
}

function QuizRunner({
  quiz,
  onBack,
}: {
  quiz: Quiz;
  onBack: () => void;
}) {
  const [submitQuiz, { isLoading }] = useSubmitQuizMutation();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { data: attempts } = useQuizAttemptsQuery(quiz.id);

  const complete = Object.keys(answers).length === quiz.questions.length;

  const submit = async () => {
    setFormError(null);
    if (!complete) {
      setFormError("Answer every question before submitting.");
      return;
    }

    try {
      const result = await submitQuiz({
        quizId: quiz.id,
        answers: quiz.questions.map(question => ({
          questionId: question.id,
          selectedAnswer: answers[question.id] ?? "",
        })),
      }).unwrap();
      setAttempt(result);
    } catch (e) {
      setFormError(apiErrorMessage(e, "Robo could not record this attempt."));
    }
  };

  return (
    <>
      <Pressable accessibilityRole="button" onPress={onBack}>
        <Text style={styles.back}>All quizzes</Text>
      </Pressable>
      <Text style={styles.intro}>{quiz.title}</Text>
      <Text style={styles.muted}>
        {[quiz.subject, quiz.topic, `${quiz.questionCount} questions`]
          .filter(Boolean)
          .join(" · ")}
      </Text>

      <Card title="QUESTIONS">
        {quiz.questions.map((question, index) => {
          const result = attempt?.results.find(
            item => item.questionId === question.id
          );

          return (
            <View key={question.id} style={styles.question}>
              <Text style={styles.questionTitle}>
                {`${index + 1}. ${question.question}`}
              </Text>
              <OptionList
                options={question.options.map(option => ({
                  value: option,
                  label: option,
                }))}
                value={answers[question.id] ?? ""}
                onChange={value =>
                  setAnswers(current => ({ ...current, [question.id]: value }))
                }
              />
              {attempt && result ? (
                <View style={styles.answerReview}>
                  <Text
                    style={[
                      styles.answerState,
                      result.isCorrect ? styles.correct : styles.incorrect,
                    ]}
                  >
                    {result.isCorrect
                      ? "Correct"
                      : `Answer: ${question.correctAnswer}`}
                  </Text>
                  {question.explanation ? (
                    <Text style={styles.rowMeta}>{question.explanation}</Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}
      </Card>

      {formError ? <ErrorBanner message={formError} /> : null}
      {attempt ? (
        <Card title="RESULT">
          <Text style={styles.intro}>{scoreTone(attempt.score)}</Text>
          <Text style={styles.rowMeta}>
            {`${attempt.results.filter(item => item.isCorrect).length}/${
              attempt.results.length
            } correct`}
          </Text>
        </Card>
      ) : (
        <Button
          label="Submit answers"
          onPress={() => void submit()}
          loading={isLoading}
          disabled={!complete}
        />
      )}

      {attempts && attempts.length > 0 ? (
        <Card title="HISTORY">
          {attempts.map(item => (
            <AttemptRow key={item.id} attempt={item} />
          ))}
        </Card>
      ) : null}
    </>
  );
}

export default function QuizzesScreen() {
  const { data: quizzes, isLoading, isError, error } = useQuizzesQuery();
  const [generateQuiz, { isLoading: generating }] = useGenerateQuizMutation();
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState("10");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: selected, isLoading: loadingSelected } = useQuizQuery(
    selectedId ?? "",
    { skip: !selectedId }
  );
  const [formError, setFormError] = useState<string | null>(null);

  const generate = async () => {
    setFormError(null);
    const questionCount = Number(count);
    if (!subject.trim() || !topic.trim()) {
      setFormError("Add a subject and topic.");
      return;
    }
    if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 20) {
      setFormError("Choose between 1 and 20 questions.");
      return;
    }

    try {
      const result = await generateQuiz({
        subject: subject.trim(),
        topic: topic.trim(),
        questionCount,
        difficulty,
      }).unwrap();
      setSelectedId(result.quiz.id);
      setSubject("");
      setTopic("");
    } catch (e) {
      setFormError(apiErrorMessage(e, "Robo could not generate that quiz."));
    }
  };

  return (
    <Screen>
      <ScreenHeader kicker="QUIZZES" />
      {selectedId ? (
        loadingSelected || !selected ? (
          <Text style={styles.muted}>Loading quiz…</Text>
        ) : (
          <QuizRunner quiz={selected} onBack={() => setSelectedId(null)} />
        )
      ) : (
        <>
          <Text style={styles.intro}>Practice, then review</Text>
          <Text style={styles.muted}>
            Generate a quiz from a topic and get an explanation for every answer.
          </Text>

          <Card title="NEW QUIZ">
            <TextField
              label="Subject"
              value={subject}
              onChangeText={setSubject}
              placeholder="Physics"
            />
            <TextField
              label="Topic"
              value={topic}
              onChangeText={setTopic}
              placeholder="Optics"
            />
            <TextField
              label="Questions"
              value={count}
              onChangeText={setCount}
              keyboardType="number-pad"
            />
            <OptionList
              label="Difficulty"
              options={difficultyOptions.map(option => ({ ...option }))}
              value={difficulty}
              onChange={value => setDifficulty(value as Difficulty)}
            />
            {formError ? <ErrorBanner message={formError} /> : null}
            <Button
              label="Generate quiz"
              onPress={() => void generate()}
              loading={generating}
            />
          </Card>

          {isError ? (
            <ErrorBanner
              message={apiErrorMessage(error, "Could not load your quizzes.")}
            />
          ) : null}

          {isLoading ? (
            <Text style={styles.muted}>Loading quizzes…</Text>
          ) : !quizzes || quizzes.length === 0 ? (
            <EmptyState
              title="No quizzes yet."
              body="Generate one above or ask Robo to quiz you."
            />
          ) : (
            <Card title="YOUR QUIZZES">
              {quizzes.map(quiz => (
                <QuizRow
                  key={quiz.id}
                  quiz={quiz}
                  onPress={() => setSelectedId(quiz.id)}
                />
              ))}
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}

function QuizRow({
  quiz,
  onPress,
}: {
  quiz: QuizSummary;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${quiz.title}`}
      onPress={onPress}
      style={({ pressed }) => [styles.quizRow, pressed ? styles.pressed : null]}
    >
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{quiz.title}</Text>
        <Text style={styles.rowMeta}>
          {[quiz.subject, `${quiz.questionCount} questions`]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  intro: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
    paddingHorizontal: spacing.xl,
  },
  muted: {
    color: colors.textMuted,
    fontSize: 14,
    paddingHorizontal: spacing.xl,
  },
  back: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "600",
    paddingHorizontal: spacing.xl,
  },
  question: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  questionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 21,
  },
  answerReview: {
    gap: spacing.xs,
  },
  answerState: {
    fontSize: 13,
    fontWeight: "700",
  },
  correct: {
    color: colors.accent,
  },
  incorrect: {
    color: colors.danger,
  },
  rowCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  rowMeta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  quizRow: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  chevron: {
    color: colors.textMuted,
    fontSize: 22,
  },
  attemptRow: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  attemptScore: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
});
