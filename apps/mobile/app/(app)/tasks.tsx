import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { t } from "@/i18n";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { OptionList } from "@/components/OptionList";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { StatusPill, type PillTone } from "@/components/StatusPill";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import {
  useCompleteTodoMutation,
  useCreateTodoMutation,
  useDeleteTodoMutation,
  useTodosQuery,
  useUpdateTodoMutation,
} from "@/api/todos-api";
import {
  formatDay,
  formatTime,
  isoDate,
  parseDateTime,
  startOfDay,
  toDate,
} from "@/lib/time";
import type { Todo, TodoPriority, TodoStatus } from "@/types";
import { colors, radii, spacing } from "@/theme";

const priorityTones: Record<TodoPriority, PillTone> = {
  urgent: "danger",
  high: "warning",
  medium: "muted",
  low: "muted",
};

const filters: { value: TodoStatus | "all"; label: string }[] = [
  { value: "pending", label: t("tasks.no_tasks") },
  { value: "all", label: t("app.empty_state") },
  { value: "completed", label: t("app.empty_state") },
];

const priorities: { value: TodoPriority; label: string }[] = [
  { value: "low", label: t("tasks.priority.low") },
  { value: "medium", label: t("tasks.priority.medium") },
  { value: "high", label: t("tasks.priority.high") },
  { value: "urgent", label: t("tasks.priority.high") },
];

function bucket(todo: Todo): "today" | "later" | "overdue" | "none" {
  if (!todo.dueAt) return "none";
  const due = startOfDay(todo.dueAt).getTime();
  const today = startOfDay(new Date()).getTime();
  if (due < today) return "overdue";
  if (due === today) return "today";

  return "later";
}

export default function TasksScreen() {
  const [filter, setFilter] = useState<TodoStatus | "all">("pending");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState<TodoPriority>("medium");
  const [formError, setFormError] = useState<string | null>(null);

  const [createTodo, { isLoading: creating }] = useCreateTodoMutation();
  const [updateTodo] = useUpdateTodoMutation();
  const [completeTodo] = useCompleteTodoMutation();
  const [deleteTodo] = useDeleteTodoMutation();

  const { data, isLoading, isError, error, refetch } = useTodosQuery();

  const todos = (data ?? []).filter(todo =>
    filter === "all" ? true : todo.status === filter
  );

  const reset = () => {
    setTitle("");
    setDueDate("");
    setDueTime("");
    setSubject("");
    setPriority("medium");
    setFormError(null);
  };

  const submit = async () => {
    if (!title.trim()) {
      setFormError("Give the task a title.");
      return;
    }

    let due: string | undefined;

    if (dueDate.trim()) {
      const parsed = parseDateTime(dueDate, dueTime.trim() || undefined);
      if (!parsed) {
        setFormError("Use a date like 2026-10-30 and a time like 18:00.");
        return;
      }
      due = parsed;
    }

    try {
      await createTodo({
        title: title.trim(),
        priority,
        ...(due ? { due } : {}),
        ...(subject.trim() ? { subject: subject.trim() } : {}),
      }).unwrap();
      reset();
    } catch {
      setFormError("Robo could not save that task. Try again.");
    }
  };

  const remove = (todo: Todo) => {
    Alert.alert("Delete task", todo.title, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => void deleteTodo(todo.id),
      },
    ]);
  };

  return (
    <Screen>
      <ScreenHeader kicker="TASKS" />

      <OptionList
        label="Show"
        value={filter}
        options={filters}
        onChange={setFilter}
      />

      {isError ? (
        <ErrorBanner
          message={
            typeof error === "string" ? error : "Tasks could not be loaded."
          }
        />
      ) : null}

      {isLoading ? (
        <Text style={styles.muted}>Loading tasks…</Text>
      ) : todos.length === 0 ? (
        <EmptyState
          title="Nothing here."
          body="Add your first task below, or ask Robo in chat."
        />
      ) : (
        todos.map(todo => {
          const done = todo.status === "completed";
          const group = bucket(todo);

          return (
            <View key={todo.id} style={styles.row}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: done }}
                accessibilityLabel={
                  done ? `Reopen ${todo.title}` : `Complete ${todo.title}`
                }
                onPress={() =>
                  void (done
                    ? updateTodo({ id: todo.id, status: "pending" })
                    : completeTodo(todo.id))
                }
                hitSlop={8}
                style={[styles.checkbox, done ? styles.checkboxOn : null]}
              >
                <Text style={styles.checkboxMark}>{done ? "✓" : "○"}</Text>
              </Pressable>

              <View style={styles.rowCopy}>
                <Text
                  style={[styles.rowTitle, done ? styles.rowTitleDone : null]}
                  numberOfLines={2}
                >
                  {todo.title}
                </Text>
                <Text style={styles.rowMeta}>
                  {todo.dueAt
                    ? `${group === "overdue" ? "Overdue" : formatDay(todo.dueAt)}${
                        todo.dueAt.includes("T") &&
                        toDate(todo.dueAt).getHours() !== 0
                          ? ` · ${formatTime(todo.dueAt)}`
                          : ""
                      }`
                    : "No due date"}
                  {todo.subject ? ` · ${todo.subject}` : ""}
                </Text>
              </View>

              <StatusPill
                label={priorityLabel(todo.priority)}
                tone={priorityTones[todo.priority]}
              />

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete ${todo.title}`}
                onPress={() => remove(todo)}
                hitSlop={10}
              >
                <Text style={styles.remove}>✕</Text>
              </Pressable>
            </View>
          );
        })
      )}

      <Card title="NEW TASK">
        <TextField
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder="Finish physics worksheet"
        />
        <TextField
          label="Due date"
          value={dueDate}
          onChangeText={setDueDate}
          placeholder={isoDate(new Date())}
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
        />
        <TextField
          label="Time"
          value={dueTime}
          onChangeText={setDueTime}
          placeholder="18:00"
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
        />
        <TextField
          label="Subject"
          value={subject}
          onChangeText={setSubject}
          placeholder="Physics"
          autoCapitalize="words"
        />
        <OptionList
          label="Priority"
          value={priority}
          options={priorities}
          onChange={setPriority}
        />
        {formError ? <ErrorBanner message={formError} /> : null}
        <Button
          label="Add task"
          onPress={() => void submit()}
          loading={creating}
        />
      </Card>

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

function priorityLabel(value: TodoPriority): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const styles = StyleSheet.create({
  muted: {
    color: colors.textMuted,
    fontSize: 14,
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
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: {
    borderColor: colors.accent,
    backgroundColor: "rgba(124, 227, 177, 0.14)",
  },
  checkboxMark: {
    color: colors.accent,
    fontSize: 15,
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
  rowTitleDone: {
    color: colors.textMuted,
    textDecorationLine: "line-through",
  },
  rowMeta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  remove: {
    color: colors.textMuted,
    fontSize: 16,
    paddingHorizontal: spacing.xs,
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
