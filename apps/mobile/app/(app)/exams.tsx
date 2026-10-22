import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { StatusPill, type PillTone } from "@/components/StatusPill";
import { TextField } from "@/components/TextField";
import {
  useApprovePlanMutation,
  useCreateExamMutation,
  useDeleteExamMutation,
  useExamsQuery,
  useGeneratePlanMutation,
  useLazyReadinessQuery,
  useUpdateExamMutation,
} from "@/api/exams-api";
import {
  daysUntil,
  formatDay,
  isoDate,
  parseDateTime,
  toDate,
} from "@/lib/time";
import type { Exam, ExamStatus, PlanGenerationResult } from "@/types";
import { colors, radii, spacing } from "@/theme";

const statusTones: Record<ExamStatus, PillTone> = {
  draft: "muted",
  active: "warning",
  completed: "success",
};

function countdownText(date: string): string {
  const days = daysUntil(date);
  if (days === 0) return "today";
  if (days > 0) return `in ${days} ${days === 1 ? "day" : "days"}`;

  return "passed";
}

export default function ExamsScreen() {
  const router = useRouter();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [dateText, setDateText] = useState("");
  const [topicsText, setTopicsText] = useState("");
  const [weightText, setWeightText] = useState("");
  const [dailyLimitText, setDailyLimitText] = useState("2");
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // No "get plan" endpoint exists, so the generated plan lives in local state.
  const [generated, setGenerated] = useState<PlanGenerationResult | null>(null);
  const [approved, setApproved] = useState(false);
  const [readinessExamId, setReadinessExamId] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useExamsQuery();
  const [createExam, { isLoading: creating }] = useCreateExamMutation();
  const [updateExam] = useUpdateExamMutation();
  const [deleteExam] = useDeleteExamMutation();
  const [generatePlan, { isLoading: generating }] = useGeneratePlanMutation();
  const [approvePlan, { isLoading: approving }] = useApprovePlanMutation();
  const [fetchReadiness, { data: readiness, isFetching: checkingReadiness }] =
    useLazyReadinessQuery();

  const exams = [...(data ?? [])].sort(
    (a, b) => toDate(a.date).getTime() - toDate(b.date).getTime()
  );
  const selected = exams.find(exam => exam.id === selectedId) ?? null;

  const select = (id: string) => {
    setSelectedId(current => (current === id ? null : id));
    setGenerated(null);
    setApproved(false);
    setActionError(null);
    setReadinessExamId(null);
  };

  const startEdit = (exam: Exam) => {
    setEditingId(exam.id);
    setSubject(exam.subject);
    setDateText(isoDate(exam.date));
    setTopicsText(exam.topics.join(", "));
    setWeightText(exam.weight === null ? "" : String(exam.weight));
    setFormError(null);
  };

  const resetForm = () => {
    setEditingId(null);
    setSubject("");
    setDateText("");
    setTopicsText("");
    setWeightText("");
    setFormError(null);
  };

  const submit = async () => {
    if (!subject.trim()) {
      setFormError("Give the exam a subject.");
      return;
    }

    const date = parseDateTime(dateText.trim());
    if (!date) {
      setFormError("Use a date like 2026-12-15.");
      return;
    }

    const topics = topicsText
      .split(",")
      .map(topic => topic.trim())
      .filter(Boolean);

    let weight: number | undefined;
    if (weightText.trim()) {
      weight = Number(weightText);
      if (!Number.isFinite(weight) || weight < 0 || weight > 100) {
        setFormError("Weight must be a number between 0 and 100.");
        return;
      }
    }

    try {
      const body = {
        subject: subject.trim(),
        date,
        topics,
        ...(weight !== undefined ? { weight } : {}),
      };
      if (editingId) {
        await updateExam({ id: editingId, ...body }).unwrap();
      } else {
        await createExam(body).unwrap();
      }
      resetForm();
    } catch {
      setFormError("Robo could not save that exam. Try again.");
    }
  };

  const activate = async () => {
    if (!selected) return;
    try {
      // Generated plans do not activate the exam; draft -> active is manual.
      await updateExam({ id: selected.id, status: "active" }).unwrap();
    } catch {
      setActionError("Robo could not activate this exam.");
    }
  };

  const generate = async () => {
    if (!selected) return;
    setActionError(null);
    const limit = Number(dailyLimitText);
    const dailyLimit = Number.isInteger(limit) && limit > 0 ? limit : undefined;
    try {
      const result = await generatePlan({
        examId: selected.id,
        ...(dailyLimit ? { dailyLimit } : {}),
      }).unwrap();
      setGenerated(result);
      setApproved(false);
    } catch {
      setActionError("Robo could not build a study plan for this exam.");
    }
  };

  // Approve takes the plan id from the generation result, not the exam id.
  const approve = async () => {
    if (!generated) return;
    setActionError(null);
    try {
      await approvePlan(generated.plan.id).unwrap();
      setApproved(true);
    } catch {
      setActionError("Robo could not approve this plan.");
    }
  };

  const checkReadiness = async () => {
    if (!selected) return;
    setActionError(null);
    try {
      await fetchReadiness(selected.id).unwrap();
      setReadinessExamId(selected.id);
    } catch {
      setActionError("Robo could not check readiness for this exam.");
    }
  };

  const remove = (exam: Exam) => {
    Alert.alert("Delete exam", exam.subject, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void deleteExam(exam.id);
          if (exam.id === selectedId) {
            setSelectedId(null);
            setGenerated(null);
            setApproved(false);
          }
          if (exam.id === editingId) {
            resetForm();
          }
        },
      },
    ]);
  };

  const preparedness = readiness
    ? Math.max(0, Math.min(100, Math.round(readiness.preparedness)))
    : 0;

  return (
    <Screen>
      <ScreenHeader kicker="EXAMS" onBack={() => router.back()} />

      {isError ? (
        <ErrorBanner
          message={
            typeof error === "string" ? error : "Exams could not be loaded."
          }
        />
      ) : null}

      {isLoading ? (
        <Text style={styles.muted}>Loading exams…</Text>
      ) : exams.length === 0 ? (
        <EmptyState
          title="No exams yet."
          body="Add an exam below and Robo can build a study plan for it."
        />
      ) : (
        <View style={styles.list}>
          {exams.map(exam => (
            <Pressable
              key={exam.id}
              accessibilityRole="button"
              accessibilityState={{ selected: exam.id === selectedId }}
              accessibilityLabel={`${exam.subject}, ${countdownText(
                exam.date
              )}, ${exam.status}`}
              onPress={() => select(exam.id)}
              style={({ pressed }) => [
                styles.row,
                exam.id === selectedId ? styles.rowOn : null,
                pressed ? styles.pressed : null,
              ]}
            >
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>{exam.subject}</Text>
                <Text style={styles.countdown}>{countdownText(exam.date)}</Text>
                <Text style={styles.rowMeta}>
                  {formatDay(exam.date)}
                  {exam.weight !== null ? ` · weight ${exam.weight}` : ""}
                  {` · ${exam.topics.length} ${
                    exam.topics.length === 1 ? "topic" : "topics"
                  }`}
                </Text>
              </View>
              <StatusPill label={exam.status} tone={statusTones[exam.status]} />
            </Pressable>
          ))}
        </View>
      )}

      {selected ? (
        <Card title={selected.subject.toUpperCase()}>
          <View style={styles.chips}>
            {selected.topics.length === 0 ? (
              <Text style={styles.muted}>No topics yet.</Text>
            ) : (
              selected.topics.map(topic => (
                <View key={topic} style={styles.chip}>
                  <Text style={styles.chipLabel}>{topic}</Text>
                </View>
              ))
            )}
          </View>

          {selected.status === "draft" ? (
            <Button
              label="Activate exam"
              variant="ghost"
              onPress={() => void activate()}
            />
          ) : null}

          <TextField
            label="Tasks per day"
            value={dailyLimitText}
            onChangeText={setDailyLimitText}
            placeholder="2"
            keyboardType="number-pad"
          />
          <Button
            label="Generate study plan"
            onPress={() => void generate()}
            loading={generating}
          />

          {generated ? (
            <View style={styles.plan}>
              <View style={styles.planHead}>
                <Text style={styles.planTitle}>
                  {`${generated.plan.totalDays}-day plan`}
                </Text>
                {approved ? (
                  <StatusPill label="approved" tone="success" />
                ) : null}
              </View>
              {generated.dailyTasks.map(task => (
                <View key={task.id} style={styles.taskRow}>
                  <Text style={styles.taskDay}>{`Day ${task.day}`}</Text>
                  <Text style={styles.taskTitle} numberOfLines={2}>
                    {task.title}
                  </Text>
                </View>
              ))}
              {!approved ? (
                <Button
                  label="Approve plan"
                  onPress={() => void approve()}
                  loading={approving}
                />
              ) : null}
            </View>
          ) : null}

          {actionError ? <ErrorBanner message={actionError} /> : null}

          <Button
            label="Check readiness"
            variant="ghost"
            onPress={() => void checkReadiness()}
            loading={checkingReadiness}
          />

          {readiness && readinessExamId === selected.id ? (
            <View style={styles.readiness}>
              <Text
                style={styles.rowMeta}
              >{`Preparedness ${preparedness}%`}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${preparedness}%` }]} />
              </View>
              {readiness.remainingTopics.length > 0 ? (
                <View style={styles.listCopy}>
                  <Text style={styles.listHeading}>Remaining topics</Text>
                  {readiness.remainingTopics.map(topic => (
                    <Text key={topic} style={styles.listItem}>
                      {`· ${topic}`}
                    </Text>
                  ))}
                </View>
              ) : null}
              {readiness.missingTasks.length > 0 ? (
                <View style={styles.listCopy}>
                  <Text style={styles.listHeading}>Missing tasks</Text>
                  {readiness.missingTasks.map(task => (
                    <Text key={task} style={styles.listItem}>
                      {`· ${task}`}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.rowActions}>
            <Button
              label="Edit details"
              variant="ghost"
              onPress={() => startEdit(selected)}
              style={styles.flexAction}
            />
            <Button
              label="Delete"
              variant="ghost"
              onPress={() => remove(selected)}
              style={styles.flexAction}
            />
          </View>
        </Card>
      ) : null}

      <Card title={editingId ? "EDIT EXAM" : "NEW EXAM"}>
        <TextField
          label="Subject"
          value={subject}
          onChangeText={setSubject}
          placeholder="Physics"
          autoCapitalize="words"
        />
        <TextField
          label="Date"
          value={dateText}
          onChangeText={setDateText}
          placeholder={isoDate(new Date())}
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
        />
        <TextField
          label="Topics"
          value={topicsText}
          onChangeText={setTopicsText}
          placeholder="Kinematics, Energy"
          autoCapitalize="words"
        />
        <TextField
          label="Weight (0-100)"
          value={weightText}
          onChangeText={setWeightText}
          placeholder="Optional"
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
        />
        {formError ? <ErrorBanner message={formError} /> : null}
        <Button
          label={editingId ? "Save changes" : "Add exam"}
          onPress={() => void submit()}
          loading={creating}
        />
        {editingId ? (
          <Button label="Cancel edit" variant="ghost" onPress={resetForm} />
        ) : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: {
    color: colors.textMuted,
    fontSize: 14,
  },
  list: {
    gap: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  rowOn: {
    borderColor: colors.accent,
  },
  pressed: {
    opacity: 0.82,
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  countdown: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: "800",
  },
  rowMeta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chipLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  plan: {
    gap: spacing.sm,
  },
  planHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  planTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  taskRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  taskDay: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "700",
    width: 64,
  },
  taskTitle: {
    color: colors.text,
    fontSize: 13,
    flex: 1,
  },
  readiness: {
    gap: spacing.sm,
  },
  barTrack: {
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    overflow: "hidden",
  },
  barFill: {
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
  listCopy: {
    gap: 2,
  },
  listHeading: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  listItem: {
    color: colors.text,
    fontSize: 13,
  },
  rowActions: {
    flexDirection: "row",
    gap: spacing.md,
  },
  flexAction: {
    flex: 1,
  },
});
