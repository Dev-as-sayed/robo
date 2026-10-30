import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { t } from "@/i18n";
import { useLocalSearchParams, useRouter } from "expo-router";
import { apiErrorStatus } from "@/api/errors";
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
  useLazyRevisionSummaryQuery,
  usePlanQuery,
  useRecalculatePlanMutation,
  useUpdateExamMutation,
} from "@/api/exams-api";
import {
  daysUntil,
  formatDay,
  isoDate,
  parseDateTime,
  toDate,
} from "@/lib/time";
import type { Exam, ExamStatus } from "@/types";
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
  const params = useLocalSearchParams<{ examId?: string }>();

  const [selectedId, setSelectedId] = useState<string | null>(() =>
    typeof params.examId === "string" ? params.examId : null
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [dateText, setDateText] = useState("");
  const [topicsText, setTopicsText] = useState("");
  const [weightText, setWeightText] = useState("");
  const [dailyLimitText, setDailyLimitText] = useState("2");
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [readinessExamId, setReadinessExamId] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useExamsQuery();
  const [createExam, { isLoading: creating }] = useCreateExamMutation();
  const [updateExam] = useUpdateExamMutation();
  const [deleteExam] = useDeleteExamMutation();
  const [generatePlan, { isLoading: generating }] = useGeneratePlanMutation();
  const [approvePlan, { isLoading: approving }] = useApprovePlanMutation();
  const [recalculatePlan, { isLoading: recalculating }] =
    useRecalculatePlanMutation();
  const [fetchReadiness, { data: readiness, isFetching: checkingReadiness }] =
    useLazyReadinessQuery();
  const [fetchRevision, { data: revision, isFetching: loadingRevision }] =
    useLazyRevisionSummaryQuery();
  const [revisionExamId, setRevisionExamId] = useState<string | null>(null);
  const {
    data: planResult,
    error: planError,
    isFetching: loadingPlan,
    refetch: refetchPlan,
  } = usePlanQuery(selectedId ?? "", { skip: !selectedId });
  const approved = Boolean(planResult?.plan.approvedAt);

  useEffect(() => {
    if (typeof params.examId === "string") {
      setSelectedId(params.examId);
    }
  }, [params.examId]);

  const exams = [...(data ?? [])].sort(
    (a, b) => toDate(a.date).getTime() - toDate(b.date).getTime()
  );
  const selected = exams.find(exam => exam.id === selectedId) ?? null;

  const select = (id: string) => {
    setSelectedId(current => (current === id ? null : id));
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
      setFormError(t("exam.give_subject"));
      return;
    }

    const date = parseDateTime(dateText.trim());
    if (!date) {
      setFormError(t("exam.use_date"));
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
      setFormError(t("exam.could_not_save"));
    }
  };

  const activate = async () => {
    if (!selected) return;
    try {
      await updateExam({ id: selected.id, status: "active" }).unwrap();
    } catch {
      setActionError(t("exam.could_not_activate"));
    }
  };

  const generate = async () => {
    if (!selected) return;
    setActionError(null);
    const limit = Number(dailyLimitText);
    const dailyLimit = Number.isInteger(limit) && limit > 0 ? limit : undefined;
    try {
      await generatePlan({
        examId: selected.id,
        ...(dailyLimit ? { dailyLimit } : {}),
      }).unwrap();
      await refetchPlan();
    } catch {
      setActionError(t("exam.could_not_generate_plan"));
    }
  };

  const approve = async () => {
    if (!planResult) return;
    setActionError(null);
    try {
      await approvePlan(planResult.plan.id).unwrap();
      await refetchPlan();
    } catch {
      setActionError(t("exam.could_not_approve"));
    }
  };

  const recalculate = async () => {
    if (!selected) return;
    setActionError(null);
    try {
      const result = await recalculatePlan(selected.id).unwrap();
      await refetchPlan();
      Alert.alert(
        t("exam.plan_updated"),
        result.rescheduled === 0
          ? t("exam.every_task_complete")
          : `${t("exam.rescheduled")} ${result.rescheduled} ${t("exam.remaining_task")}${result.rescheduled === 1 ? "" : "s"} ${t("exam.spread_over")} ${result.daysLeft} ${t("exam.days_left")}.`
      );
    } catch {
      setActionError(t("exam.could_not_recalculate"));
    }
  };

  const loadRevision = async () => {
    if (!selected) return;
    setActionError(null);
    try {
      await fetchRevision(selected.id).unwrap();
      setRevisionExamId(selected.id);
    } catch {
      setActionError(t("exam.could_not_revision_summary"));
    }
  };

  const checkReadiness = async () => {
    if (!selected) return;
    setActionError(null);
    try {
      await fetchReadiness(selected.id).unwrap();
      setReadinessExamId(selected.id);
    } catch {
      setActionError(t("exam.could_not_check_readiness"));
    }
  };

  const remove = (exam: Exam) => {
    Alert.alert(t("exam.delete_exam"), exam.subject, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void deleteExam(exam.id);
          if (exam.id === selectedId) {
            setSelectedId(null);
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
          title={t("exam.no_exams_yet")}
          body={t("exam.add_exam_and_plan")}
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
              label={t("exam.activate_exam")}
              variant="ghost"
              onPress={() => void activate()}
            />
          ) : null}

          {!planResult ? (
            <>
              <TextField
                label={t("exam.tasks_per_day")}
                value={dailyLimitText}
                onChangeText={setDailyLimitText}
                placeholder="2"
                keyboardType="number-pad"
              />
              <Button
                label={t("exam.generate_plan")}
                onPress={() => void generate()}
                loading={generating}
              />
            </>
          ) : null}

          {loadingPlan && !planResult ? (
            <Text style={styles.muted}>Loading plan…</Text>
          ) : null}

          {planError && apiErrorStatus(planError) !== 404 ? (
            <ErrorBanner message="Robo could not load this study plan." />
          ) : null}

          {planResult ? (
            <View style={styles.plan}>
              <View style={styles.planHead}>
                <Text style={styles.planTitle}>
                  {`${planResult.plan.totalDays}-day plan`}
                </Text>
                {approved ? (
                  <StatusPill label="approved" tone="success" />
                ) : null}
              </View>
              {planResult.dailyTasks.map(task => (
                <View key={task.id} style={styles.taskRow}>
                  <Text style={styles.taskDay}>{`Day ${task.day}`}</Text>
                  <Text style={styles.taskTitle} numberOfLines={2}>
                    {task.title}
                  </Text>
                </View>
              ))}
              {!approved ? (
                <Button
                  label={t("exam.approve_plan")}
                  onPress={() => void approve()}
                  loading={approving}
                />
              ) : (
                <Button
                  label={t("exam.recalculate_remaining")}
                  variant="ghost"
                  onPress={() => void recalculate()}
                  loading={recalculating}
                />
              )}
            </View>
          ) : null}

          {actionError ? <ErrorBanner message={actionError} /> : null}

          <View style={styles.rowActions}>
            <Button
              label="Check readiness"
              variant="ghost"
              onPress={() => void checkReadiness()}
              loading={checkingReadiness}
            />
            <Button
              label="Revision summary"
              variant="ghost"
              onPress={() => void loadRevision()}
              loading={loadingRevision}
            />
          </View>

          {revision && revisionExamId === selected.id ? (
            <Card title="REVISION">
              <Text style={styles.rowMeta}>{revision.narrative}</Text>
              {revision.nextTask ? (
                <Text style={styles.rowMeta}>
                  {`Next task: ${revision.nextTask.title}`}
                </Text>
              ) : null}
              {revision.weakTopics.length > 0 ? (
                <Text style={styles.rowMeta}>
                  {`Weak topics: ${revision.weakTopics.join(", ")}`}
                </Text>
              ) : null}
            </Card>
          ) : null}

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
