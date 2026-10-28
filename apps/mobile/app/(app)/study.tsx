import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import {
  useActiveSessionQuery,
  useEndSessionMutation,
  useExtendSessionMutation,
  usePauseSessionMutation,
  useResumeSessionMutation,
  useSessionsQuery,
  useStartSessionMutation,
} from "@/api/sessions-api";
import type { StudySessionResult } from "@/types";
import {
  openFocusSettings,
  promptForDoNotDisturb,
} from "@/study/focus";
import { colors, radii, spacing } from "@/theme";

const PLAN_OPTIONS = [25, 45, 60];
const POMODORO_FOCUS_MINUTES = 25;
const POMODORO_BREAK_MINUTES = 5;

function elapsedSeconds(result: StudySessionResult, now: number): number {
  const { session } = result;
  const end = session.endedAt ? new Date(session.endedAt).getTime() : now;
  const started = new Date(session.startedAt).getTime();
  const openPause = session.pausedAt
    ? Math.max(0, end - new Date(session.pausedAt).getTime())
    : 0;

  return Math.max(
    0,
    Math.floor((end - started - session.totalPausedMs - openPause) / 1000)
  );
}

function clock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function describeError(error: unknown): string {
  return typeof error === "string" ? error : "The session could not be updated.";
}

export default function StudyScreen() {
  const router = useRouter();
  const { data: active, isError, error, refetch } = useActiveSessionQuery();
  const { data: sessions } = useSessionsQuery();
  const [startSession, startState] = useStartSessionMutation();
  const [pauseSession] = usePauseSessionMutation();
  const [resumeSession] = useResumeSessionMutation();
  const [extendSession] = useExtendSessionMutation();
  const [endSession] = useEndSessionMutation();

  const [subject, setSubject] = useState("");
  const [planned, setPlanned] = useState<number | null>(45);
  const [pomodoro, setPomodoro] = useState(false);
  const [breakAtSeconds, setBreakAtSeconds] = useState<number | null>(null);
  const [onBreak, setOnBreak] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) {
      return;
    }

    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [active]);

  useEffect(() => {
    if (!active) {
      setBreakAtSeconds(null);
      setOnBreak(false);
      return;
    }

    if (!pomodoro || breakAtSeconds !== null) {
      return;
    }

    const focusSeconds =
      (active.session.plannedMinutes ?? POMODORO_FOCUS_MINUTES) * 60;
    setBreakAtSeconds(elapsedSeconds(active, Date.now()) + focusSeconds);
  }, [active, breakAtSeconds, pomodoro]);

  const run = async (task: () => Promise<unknown>): Promise<boolean> => {
    setActionError(null);
    try {
      await task();
      await refetch();
      setNow(Date.now());
      return true;
    } catch (caught) {
      setActionError(describeError(caught));
      return false;
    }
  };

  const elapsed = active ? elapsedSeconds(active, now) : 0;
  const breakDue =
    Boolean(active) &&
    pomodoro &&
    !onBreak &&
    active?.session.status === "active" &&
    breakAtSeconds !== null &&
    elapsed >= breakAtSeconds;
  const nextBreakIn =
    pomodoro && breakAtSeconds !== null
      ? Math.max(0, breakAtSeconds - elapsed)
      : null;

  const togglePomodoro = (): void => {
    setPomodoro(current => {
      if (!current) {
        setPlanned(POMODORO_FOCUS_MINUTES);
      }
      return !current;
    });
  };

  const start = async (): Promise<void> => {
    setBreakAtSeconds(null);
    setOnBreak(false);

    const started = await run(() =>
      startSession({
        ...(subject.trim() ? { subject: subject.trim() } : {}),
        ...(planned ? { plannedMinutes: planned } : {}),
      }).unwrap()
    );

    if (started) {
      void promptForDoNotDisturb();
    }
  };

  const pause = async (): Promise<void> => {
    if (!active) return;
    await run(() => pauseSession(active.session.id).unwrap());
  };

  const resume = async (): Promise<void> => {
    if (!active) return;

    const resumed = await run(() => resumeSession(active.session.id).unwrap());
    if (!resumed) return;

    const focusSeconds =
      (active.session.plannedMinutes ?? POMODORO_FOCUS_MINUTES) * 60;
    setOnBreak(false);
    setBreakAtSeconds(
      pomodoro ? elapsedSeconds(active, Date.now()) + focusSeconds : null
    );
  };

  const takeBreak = async (): Promise<void> => {
    if (!active) return;

    const paused = await run(() => pauseSession(active.session.id).unwrap());
    if (paused) {
      setOnBreak(true);
    }
  };

  const end = async (): Promise<void> => {
    if (!active) return;

    const ended = await run(() => endSession(active.session.id).unwrap());
    if (ended) {
      setBreakAtSeconds(null);
      setOnBreak(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader
        kicker="STUDY TIMER"
        onBack={router.canGoBack() ? () => router.back() : undefined}
      />

      {isError ? (
        <ErrorBanner
          message={typeof error === "string" ? error : "The session could not be loaded."}
        />
      ) : null}
      {actionError ? <ErrorBanner message={actionError} /> : null}

      {active ? (
        <>
          <Card title="CURRENT SESSION" tone="accent">
            <Text style={styles.subject}>
              {active.session.subject ?? "Study session"}
            </Text>
            <Text style={styles.clock}>{clock(elapsed)}</Text>
            <Text style={styles.muted}>
              {active.session.status === "paused"
                ? onBreak
                  ? `On a ${POMODORO_BREAK_MINUTES}-minute break. Resume when you are ready.`
                  : "Paused — the clock is frozen."
                : `Running${active.session.plannedMinutes ? ` · ${active.session.plannedMinutes} min planned` : ""}${
                    nextBreakIn !== null ? ` · break in ${clock(nextBreakIn)}` : ""
                  }`}
            </Text>

            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  void (active.session.status === "paused" ? resume() : pause())
                }
                style={({ pressed }) => [styles.button, pressed ? styles.pressed : null]}
              >
                <Text style={styles.buttonLabel}>
                  {active.session.status === "paused" ? "Resume" : "Pause"}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  void run(() =>
                    extendSession({ id: active.session.id, minutes: 5 }).unwrap()
                  )
                }
                style={({ pressed }) => [styles.button, pressed ? styles.pressed : null]}
              >
                <Text style={styles.buttonLabel}>+5 min</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => void end()}
                style={({ pressed }) => [
                  styles.button,
                  styles.buttonEnd,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Text style={styles.buttonEndLabel}>End</Text>
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => void openFocusSettings()}
              style={({ pressed }) => [pressed ? styles.pressed : null]}
            >
              <Text style={styles.focusLink}>Enable Do Not Disturb</Text>
            </Pressable>
          </Card>

          {breakDue ? (
            <Card title="BREAK TIME" tone="accent">
              <Text style={styles.muted}>
                You have focused for {Math.max(1, Math.round(elapsed / 60))}{" "}
                minutes. Take {POMODORO_BREAK_MINUTES} minutes away from the
                screen, then resume for the next cycle.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => void takeBreak()}
                style={({ pressed }) => [
                  styles.start,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Text style={styles.startLabel}>
                  Take a {POMODORO_BREAK_MINUTES}-minute break
                </Text>
              </Pressable>
            </Card>
          ) : null}
        </>
      ) : (
        <Card title="START A SESSION">
          <Text style={styles.label}>Subject (optional)</Text>
          <TextInput
            value={subject}
            onChangeText={setSubject}
            placeholder="e.g. Calculus"
            placeholderTextColor={colors.textMuted}
            maxLength={100}
            style={styles.input}
          />

          <Text style={styles.label}>Planned time</Text>
          <View style={styles.chips}>
            {PLAN_OPTIONS.map(minutes => {
              const selected = planned === minutes;
              return (
                <Pressable
                  key={minutes}
                  accessibilityRole="button"
                  onPress={() => setPlanned(selected ? null : minutes)}
                  style={[styles.chip, selected ? styles.chipOn : null]}
                >
                  <Text style={[styles.chipLabel, selected ? styles.chipLabelOn : null]}>
                    {minutes} min
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={togglePomodoro}
            style={[styles.chip, styles.pomodoroChip, pomodoro ? styles.chipOn : null]}
          >
            <Text style={[styles.chipLabel, pomodoro ? styles.chipLabelOn : null]}>
              Pomodoro · {planned ?? POMODORO_FOCUS_MINUTES}/
              {POMODORO_BREAK_MINUTES}
            </Text>
          </Pressable>
          {pomodoro ? (
            <Text style={styles.muted}>
              Focus for {planned ?? POMODORO_FOCUS_MINUTES} minutes, then take a{" "}
              {POMODORO_BREAK_MINUTES}-minute break. Repeat until you end the
              session.
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={startState.isLoading}
            onPress={() => void start()}
            style={({ pressed }) => [
              styles.start,
              startState.isLoading ? styles.startDisabled : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.startLabel}>
              {startState.isLoading ? "Starting…" : "Start studying"}
            </Text>
          </Pressable>
        </Card>
      )}

      <Text style={styles.sectionTitle}>RECENT SESSIONS</Text>
      {sessions && sessions.length === 0 ? (
        <EmptyState
          title="No sessions yet."
          body="Finish a session and it will appear here with the measured study time."
        />
      ) : (
        <View style={styles.history}>
          {(sessions ?? []).slice(0, 8).map(result => (
            <View key={result.session.id} style={styles.historyRow}>
              <View style={styles.historyText}>
                <Text style={styles.historyTitle}>
                  {result.session.subject ?? "Study session"}
                </Text>
                <Text style={styles.historyMeta}>
                  {new Date(result.session.startedAt).toLocaleDateString()} ·{" "}
                  {result.session.status}
                </Text>
              </View>
              <Text style={styles.historyMinutes}>{result.studyMinutes} min</Text>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  subject: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  clock: {
    color: colors.accent,
    fontSize: 56,
    fontWeight: "800",
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  muted: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.background,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
  },
  chips: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  chipOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  pomodoroChip: {
    alignSelf: "flex-start",
  },
  chipLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  chipLabelOn: {
    color: colors.background,
  },
  start: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    alignItems: "center",
    paddingVertical: spacing.lg,
    marginTop: spacing.sm,
  },
  startDisabled: {
    opacity: 0.6,
  },
  startLabel: {
    color: colors.background,
    fontSize: 15,
    fontWeight: "800",
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  button: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  buttonEnd: {
    borderColor: colors.danger,
  },
  buttonLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  buttonEndLabel: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.75,
  },
  focusLink: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    marginTop: spacing.sm,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.4,
    marginTop: spacing.lg,
  },
  history: {
    gap: spacing.sm,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.lg,
  },
  historyText: {
    flex: 1,
    gap: 2,
  },
  historyTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  historyMeta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  historyMinutes: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "800",
  },
});
