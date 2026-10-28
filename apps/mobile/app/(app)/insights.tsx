import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { OptionList, type Option } from "@/components/OptionList";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useSubjectTrendQuery, useSummaryQuery } from "@/api/analytics-api";
import { useSubjectsQuery } from "@/api/subjects-api";
import type { AnalyticsRange, AnalyticsSummary } from "@/types";
import { colors, spacing } from "@/theme";

const rangeOptions: Option<AnalyticsRange>[] = [
  { value: "day", label: "Today" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

const rangeTitles: Record<AnalyticsRange, string> = {
  day: "since midnight",
  week: "since the start of the week",
  month: "since the 1st",
  year: "since January 1",
};

function formatCount(value: number): string {
  if (!Number.isFinite(value)) return "—";

  return String(Math.round(value));
}

/**
 * Only hours get a decimal; counts are integers by nature.
 */
function formatHours(value: number): string {
  if (!Number.isFinite(value)) return "—";

  const rounded = Math.round(value * 10) / 10;

  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

interface Stat {
  label: string;
  value: string;
  unit: string;
  note: string;
}

/**
 * Every note below mirrors what the shared analytics query actually does today,
 * so estimated and not-yet-implemented numbers are never sold as measurements.
 */
function buildStats(summary: AnalyticsSummary): Stat[] {
  return [
    {
      label: "STUDY TIME",
      value: formatHours(summary.totalStudyHours),
      unit: "hours",
      note: "Measured from study-session timers, excluding paused time. A running session counts up to now.",
    },
    {
      label: "TASKS DONE",
      value: formatCount(summary.completedTasks),
      unit: "tasks",
      note: "Counted when a task is completed; the completion timestamp is written in the same update.",
    },
    {
      label: "QUIZZES DONE",
      value: formatCount(summary.completedQuizzes),
      unit: "quizzes",
      note: "Real count of graded quiz attempts in the selected range.",
    },
    {
      label: "ACTIVE REMINDERS",
      value: formatCount(summary.activeReminders),
      unit: "reminders",
      note: "Real count of reminders still marked active. Not limited to the selected range.",
    },
    {
      label: "EXAMS AHEAD",
      value: formatCount(summary.upcomingExams),
      unit: "exams",
      note: "Counts upcoming exams in draft or active state.",
    },
    {
      label: "STREAK",
      value: formatCount(summary.streakDays),
      unit: "days",
      note: "Consecutive days with a completed task or a study session, ending today or yesterday.",
    },
  ];
}

function isAllZero(summary: AnalyticsSummary): boolean {
  return (
    summary.totalStudyHours === 0 &&
    summary.completedTasks === 0 &&
    summary.completedQuizzes === 0 &&
    summary.activeReminders === 0 &&
    summary.upcomingExams === 0 &&
    summary.streakDays === 0
  );
}

export default function InsightsScreen() {
  const router = useRouter();

  const [range, setRange] = useState<AnalyticsRange>("week");
  const [subjectId, setSubjectId] = useState<string | null>(null);

  const { data: subjects } = useSubjectsQuery();
  const trend = useSubjectTrendQuery(subjectId ?? "", { skip: !subjectId });

  const {
    data: summary,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useSummaryQuery(range);

  const stats = summary ? buildStats(summary) : [];

  return (
    <Screen>
      <ScreenHeader
        kicker="INSIGHTS"
        onBack={router.canGoBack() ? () => router.back() : undefined}
      />

      <OptionList
        label="Range"
        value={range}
        options={rangeOptions}
        onChange={setRange}
      />

      {isError ? (
        <ErrorBanner
          message={
            typeof error === "string" ? error : "Insights could not be loaded."
          }
        />
      ) : null}

      {summary ? (
        <>
          <Text style={styles.narrative}>{summary.narrative}</Text>
          <Text style={styles.caption}>
            {`Numbers ${rangeTitles[range]}.`}{" "}
            {isFetching ? "Updating…" : "Counts come from your stored activity."}
          </Text>
        </>
      ) : null}

      {isLoading ? (
        <Text style={styles.muted}>Loading insights…</Text>
      ) : !summary ? null : isAllZero(summary) ? (
        <EmptyState
          title="No activity to summarise yet."
          body="Your numbers will appear here once tasks, reminders and study sessions exist. Start a session from the study screen to see study time and streaks grow."
        />
      ) : (
        <>
          <View style={styles.grid}>
            {stats.map(stat => (
              <View key={stat.label} style={styles.gridItem}>
                <Card title={stat.label}>
                  <View style={styles.statLine}>
                    <Text style={styles.statValue}>{stat.value}</Text>
                    <Text style={styles.statUnit}>{stat.unit}</Text>
                  </View>
                  <Text style={styles.statNote}>{stat.note}</Text>
                </Card>
              </View>
            ))}
          </View>

          <Card
            title="DAY STREAK"
            tone={summary.streakDays > 0 ? "accent" : "default"}
          >
            <Text style={styles.streakValue}>
              {formatCount(summary.streakDays)} day
              {summary.streakDays === 1 ? "" : "s"}
            </Text>
            <Text style={styles.statNote}>
              A day counts when you complete a task or run a study session. The
              streak stays alive through yesterday until your first activity
              today.
            </Text>
          </Card>
        </>
      )}

      <Card title="BY SUBJECT">
        {!subjects || subjects.length === 0 ? (
          <Text style={styles.muted}>
            Add a subject from study material or chat, then trends appear here.
          </Text>
        ) : (
          <>
            <View style={styles.subjectChips}>
              {subjects.map(subject => {
                const selected = subject.id === subjectId;
                return (
                  <Pressable
                    key={subject.id}
                    accessibilityRole="button"
                    onPress={() => setSubjectId(selected ? null : subject.id)}
                    style={[styles.subjectChip, selected ? styles.subjectChipOn : null]}
                  >
                    <Text
                      style={[
                        styles.subjectChipLabel,
                        selected ? styles.subjectChipLabelOn : null,
                      ]}
                    >
                      {subject.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {!subjectId ? (
              <Text style={styles.muted}>Pick a subject to see its trend.</Text>
            ) : trend.isError ? (
              <ErrorBanner message="This subject trend could not be loaded." />
            ) : !trend.data ? (
              <Text style={styles.muted}>Loading subject trend…</Text>
            ) : (
              <>
                <View style={styles.trendRow}>
                  <View style={styles.trendStat}>
                    <Text style={styles.statValue}>{formatHours(trend.data.studyHours)}</Text>
                    <Text style={styles.statUnit}>hours</Text>
                  </View>
                  <View style={styles.trendStat}>
                    <Text style={styles.statValue}>{formatCount(trend.data.completedTasks)}</Text>
                    <Text style={styles.statUnit}>tasks done</Text>
                  </View>
                  <View style={styles.trendStat}>
                    <Text style={styles.statValue}>{formatCount(trend.data.quizAverage)}</Text>
                    <Text style={styles.statUnit}>quiz avg</Text>
                  </View>
                </View>
                {trend.data.recentActivities.length > 0 ? (
                  trend.data.recentActivities.slice(0, 4).map(activity => (
                    <Text key={activity} style={styles.muted}>
                      · {activity}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.muted}>No activity for this subject yet.</Text>
                )}
              </>
            )}
          </>
        )}
      </Card>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/study")}
        style={({ pressed }) => [styles.studyLink, pressed ? styles.pressed : null]}
      >
        <Text style={styles.studyLinkLabel}>Open study timer</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={() => void refetch()}
        style={({ pressed }) => [
          styles.refresh,
          pressed ? styles.pressed : null,
        ]}
      >
        <Text style={styles.refreshLabel}>Refresh</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: {
    color: colors.textMuted,
    fontSize: 14,
  },
  caption: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  narrative: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
  },
  subjectChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  subjectChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  subjectChipOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  subjectChipLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  subjectChipLabelOn: {
    color: colors.background,
  },
  trendRow: {
    flexDirection: "row",
    gap: spacing.lg,
  },
  trendStat: {
    flex: 1,
    gap: 2,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  gridItem: {
    flexGrow: 1,
    flexBasis: "47%",
  },
  statLine: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.sm,
  },
  statValue: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  statUnit: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  statNote: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  streakValue: {
    color: colors.accent,
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -1,
  },
  studyLink: {
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 12,
    paddingVertical: spacing.md,
  },
  studyLinkLabel: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "700",
  },
  refresh: {
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  refreshLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.82,
  },
});
