import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { OptionList, type Option } from "@/components/OptionList";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useSummaryQuery } from "@/api/analytics-api";
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
      note: "Estimated. The server multiplies study-session rows by a fixed 30 minutes, and no session timer writes those rows yet.",
    },
    {
      label: "TASKS DONE",
      value: formatCount(summary.completedTasks),
      unit: "tasks",
      note: "Counted only when a task carries a completion timestamp. The complete endpoint flips the status but never stores that timestamp, so this stays at 0.",
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
      note: "Only counts exams marked active. New exams are stored as draft and nothing promotes them, so this reads 0 until an exam is activated.",
    },
    {
      label: "STREAK",
      value: formatCount(summary.streakDays),
      unit: "days",
      note: "Placeholder. The server returns a hardcoded 0 for streaks, so this is not your real streak.",
    },
  ];
}

function isAllZero(summary: AnalyticsSummary): boolean {
  return Object.values(summary).every(value => value === 0);
}

export default function InsightsScreen() {
  const router = useRouter();

  const [range, setRange] = useState<AnalyticsRange>("week");

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
        <Text style={styles.caption}>
          {`Numbers ${rangeTitles[range]}.`}{" "}
          {isFetching
            ? "Updating…"
            : "Some fields are still estimates — each card says which."}
        </Text>
      ) : null}

      {isLoading ? (
        <Text style={styles.muted}>Loading insights…</Text>
      ) : !summary ? null : isAllZero(summary) ? (
        <EmptyState
          title="No activity to summarise yet."
          body="Your numbers will appear here once tasks, reminders and study sessions exist. Streaks and study hours are not measured by the server yet, so those two stay at zero even once you start."
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
              This card turns green once you have a real run of study days. The
              server hardcodes the streak to zero today, so a green card would
              mean measured consecutive days, not decoration.
            </Text>
          </Card>
        </>
      )}

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
