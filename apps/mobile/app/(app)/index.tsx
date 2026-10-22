import { useRouter, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Screen } from "@/components/Screen";
import { StatusPill, type PillTone } from "@/components/StatusPill";
import { useExamsQuery } from "@/api/exams-api";
import { useScheduleQuery } from "@/api/schedule-api";
import { useCompleteTodoMutation, useTodosQuery } from "@/api/todos-api";
import {
  daysUntil,
  formatDay,
  formatRange,
  formatTime,
  startOfDay,
  toDate,
} from "@/lib/time";
import { useAppSelector } from "@/store";
import type { ScheduleEntry, Todo } from "@/types";
import { colors, radii, spacing } from "@/theme";

const priorityTones: Record<Todo["priority"], PillTone> = {
  urgent: "danger",
  high: "warning",
  medium: "muted",
  low: "muted",
};

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";

  return "Good evening";
}

function isSameDay(value: string): boolean {
  return startOfDay(value).getTime() === startOfDay(new Date()).getTime();
}

function startOfTodayMs(): number {
  return startOfDay(new Date()).getTime();
}

function upcomingClass(entries: ScheduleEntry[]): ScheduleEntry | undefined {
  const now = Date.now();

  return [...entries]
    .sort((a, b) => toDate(a.startAt).getTime() - toDate(b.startAt).getTime())
    .find(
      entry =>
        !entry.allDay &&
        toDate(entry.endAt ?? entry.startAt).getTime() >= now &&
        isSameDay(entry.startAt)
    );
}

function taskRows(todos: Todo[]): { todo: Todo; overdue: boolean }[] {
  const startOfToday = startOfTodayMs();
  const due = todos.filter(todo => todo.dueAt && isSameDay(todo.dueAt));
  const late = todos.filter(
    todo => todo.dueAt && toDate(todo.dueAt).getTime() < startOfToday
  );

  return [
    ...late.map(todo => ({ todo, overdue: true })),
    ...due.map(todo => ({ todo, overdue: false })),
  ];
}

interface Shortcut {
  label: string;
  hint: string;
  route: Href;
}

const shortcuts: Shortcut[] = [
  { label: "Reminders", hint: "Snooze & reschedule", route: "/reminders" },
  { label: "Timetable", hint: "Weekly classes", route: "/schedule" },
  { label: "Exams", hint: "Countdown & plan", route: "/exams" },
  { label: "Notes", hint: "Upload study material", route: "/documents" },
  { label: "Contacts", hint: "Call & message", route: "/contacts" },
  { label: "Activity", hint: "What Robo did", route: "/activity" },
  { label: "Devices", hint: "Pair the speaker", route: "/devices" },
];

export default function TodayScreen() {
  const router = useRouter();
  const user = useAppSelector(state => state.auth.user);
  const [completeTodo] = useCompleteTodoMutation();

  const schedule = useScheduleQuery();
  const todos = useTodosQuery({ status: "pending" });
  const exams = useExamsQuery({ status: "active" });

  if (!user) {
    return null;
  }

  const firstName = user.name?.split(" ")[0] || "there";
  const classes = schedule.data ?? [];
  const next = upcomingClass(classes);
  const rows = taskRows(todos.data ?? []);
  const nextExam = [...(exams.data ?? [])].sort(
    (a, b) => toDate(a.date).getTime() - toDate(b.date).getTime()
  )[0];
  const failed =
    (schedule.isError && schedule.error) ||
    (todos.isError && todos.error) ||
    (exams.isError && exams.error);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.brand}>ROBO</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/settings")}
          hitSlop={12}
        >
          <Text style={styles.headerAction}>Settings</Text>
        </Pressable>
      </View>

      <View style={styles.greeting}>
        <Text style={styles.hello}>
          {greeting()}, {firstName}.
        </Text>
        <Text style={styles.subtitle}>{formatDay(new Date())}</Text>
      </View>

      {failed ? (
        <ErrorBanner message="Some of your day could not be loaded. Pull down to retry." />
      ) : null}

      <Card title={next ? "NEXT CLASS" : "NOT IN CLASS"}>
        {next ? (
          <View style={styles.classBody}>
            <Text style={styles.classTitle}>{next.title}</Text>
            <Text style={styles.classMeta}>
              {formatRange(next.startAt, next.endAt)}
              {next.room ? ` · ${next.room}` : ""}
              {next.teacher ? ` · ${next.teacher}` : ""}
            </Text>
          </View>
        ) : (
          <EmptyState
            title="Nothing scheduled for the rest of today."
            body="Add a class in the timetable and it shows up here."
          />
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/schedule")}
          style={({ pressed }) => [
            styles.link,
            pressed ? styles.pressed : null,
          ]}
        >
          <Text style={styles.linkLabel}>Open timetable</Text>
        </Pressable>
      </Card>

      <Card
        title={`TODAY · ${rows.length}`}
        right={<StatusPill label="Tasks" tone="success" />}
      >
        {rows.length === 0 ? (
          <EmptyState
            title="No tasks due."
            body="Ask Robo in chat to add one, or add it yourself."
          />
        ) : (
          rows.slice(0, 4).map(({ todo, overdue }) => (
            <View key={todo.id} style={styles.taskRow}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel={`Complete ${todo.title}`}
                onPress={() => void completeTodo(todo.id)}
                hitSlop={8}
                style={styles.checkbox}
              >
                <Text style={styles.checkboxMark}>○</Text>
              </Pressable>
              <View style={styles.taskCopy}>
                <Text style={styles.taskTitle} numberOfLines={2}>
                  {todo.title}
                </Text>
                <Text style={styles.taskMeta}>
                  {overdue ? "Overdue" : "Due"}
                  {todo.dueAt ? ` · ${formatTime(todo.dueAt)}` : ""}
                </Text>
              </View>
              <StatusPill
                label={todo.priority}
                tone={priorityTones[todo.priority]}
              />
            </View>
          ))
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/tasks")}
          style={({ pressed }) => [
            styles.link,
            pressed ? styles.pressed : null,
          ]}
        >
          <Text style={styles.linkLabel}>Manage tasks</Text>
        </Pressable>
      </Card>

      {nextExam ? (
        <Card title="NEXT EXAM" tone="accent">
          <Text style={styles.examSubject}>{nextExam.subject}</Text>
          <Text style={styles.examCountdown}>
            {Math.max(0, daysUntil(nextExam.date))} days
          </Text>
          <Text style={styles.examMeta}>
            {formatDay(nextExam.date)}
            {nextExam.topics.length
              ? ` · ${nextExam.topics.slice(0, 3).join(", ")}`
              : ""}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/exams")}
            style={({ pressed }) => [
              styles.link,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.linkLabel}>Study plan</Text>
          </Pressable>
        </Card>
      ) : null}

      <View style={styles.shortcuts}>
        <Text style={styles.sectionLabel}>LIBRARY</Text>
        {shortcuts.map(shortcut => (
          <Pressable
            key={shortcut.label}
            accessibilityRole="button"
            onPress={() => router.push(shortcut.route)}
            style={({ pressed }) => [
              styles.shortcut,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.shortcutLabel}>{shortcut.label}</Text>
            <Text style={styles.shortcutHint}>{shortcut.hint}</Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 3,
  },
  headerAction: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
  greeting: {
    gap: spacing.xs,
  },
  hello: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
  },
  classBody: {
    gap: spacing.xs,
  },
  classTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  classMeta: {
    color: colors.textMuted,
    fontSize: 14,
  },
  link: {
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  linkLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.82,
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxMark: {
    color: colors.accent,
    fontSize: 16,
  },
  taskCopy: {
    flex: 1,
    gap: 2,
  },
  taskTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  taskMeta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  examSubject: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  examCountdown: {
    color: colors.accent,
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -1,
  },
  examMeta: {
    color: colors.textMuted,
    fontSize: 13,
  },
  shortcuts: {
    gap: spacing.md,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.8,
  },
  shortcut: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  shortcutLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  shortcutHint: {
    color: colors.textMuted,
    fontSize: 13,
    flexShrink: 1,
    textAlign: "right",
  },
});
