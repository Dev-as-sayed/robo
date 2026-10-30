import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { TextField } from "@/components/TextField";
import {
  useAddExceptionMutation,
  useCreateScheduleMutation,
  useDeleteScheduleMutation,
  useRemoveExceptionMutation,
  useScheduleQuery,
  useUpdateScheduleMutation,
} from "@/api/schedule-api";
import {
  formatDay,
  formatRange,
  isoDate,
  isoTime,
  parseDateTime,
  startOfDay,
} from "@/lib/time";
import type { ScheduleEntry } from "@/types";
import { colors, radii, spacing } from "@/theme";

interface Section {
  day: string;
  entries: ScheduleEntry[];
}

function groupByDay(entries: ScheduleEntry[]): Section[] {
  const sorted = [...entries].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  );

  const buckets = new Map<string, ScheduleEntry[]>();

  for (const entry of sorted) {
    const key = isoDate(startOfDay(entry.startAt));
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(entry);
    } else {
      buckets.set(key, [entry]);
    }
  }

  return [...buckets.entries()].map(([day, dayEntries]) => ({
    day,
    entries: dayEntries,
  }));
}

export default function ScheduleScreen() {
  const router = useRouter();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [datePart, setDatePart] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [subject, setSubject] = useState("");
  const [room, setRoom] = useState("");
  const [teacher, setTeacher] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useScheduleQuery({
    includeSkipped: true,
  });
  const [createSchedule, { isLoading: creating }] = useCreateScheduleMutation();
  const [updateSchedule, { isLoading: updating }] = useUpdateScheduleMutation();
  const [deleteSchedule] = useDeleteScheduleMutation();
  const [addException] = useAddExceptionMutation();
  const [removeException] = useRemoveExceptionMutation();

  const sections = groupByDay(data ?? []);

  const reset = () => {
    setEditingId(null);
    setTitle("");
    setDatePart("");
    setStartTime("");
    setEndTime("");
    setSubject("");
    setRoom("");
    setTeacher("");
    setAllDay(false);
    setFormError(null);
  };

  const startEdit = (entry: ScheduleEntry) => {
    setEditingId(entry.id);
    setTitle(entry.title);
    setDatePart(isoDate(entry.startAt));
    setStartTime(entry.allDay ? "" : isoTime(entry.startAt));
    setEndTime(entry.allDay || !entry.endAt ? "" : isoTime(entry.endAt));
    setSubject(entry.subject ?? "");
    setRoom(entry.room ?? "");
    setTeacher(entry.teacher ?? "");
    setAllDay(entry.allDay);
    setFormError(null);
  };

  const submit = async () => {
    if (!title.trim()) {
      setFormError("Give the entry a title.");
      return;
    }

    if (!datePart.trim()) {
      setFormError("Pick a date for this entry.");
      return;
    }

    const startAt = parseDateTime(
      datePart,
      allDay ? undefined : startTime.trim() || undefined
    );
    if (!startAt) {
      setFormError("Use a date like 2026-10-30 and a time like 09:00.");
      return;
    }

    let endAt: string | undefined;

    if (!allDay && endTime.trim()) {
      const parsedEnd = parseDateTime(datePart, endTime.trim());
      if (!parsedEnd) {
        setFormError("End time should look like 10:30.");
        return;
      }
      endAt = parsedEnd;
    }

    const input = {
      title: title.trim(),
      startAt,
      allDay,
      ...(endAt ? { endAt } : {}),
      ...(subject.trim() ? { subject: subject.trim() } : {}),
      ...(room.trim() ? { room: room.trim() } : {}),
      ...(teacher.trim() ? { teacher: teacher.trim() } : {}),
    };

    try {
      if (editingId) {
        await updateSchedule({ id: editingId, ...input }).unwrap();
      } else {
        await createSchedule(input).unwrap();
      }
      reset();
    } catch {
      setFormError("Robo could not save that entry. Try again.");
    }
  };

  const skip = (entry: ScheduleEntry) => {
    void addException({
      id: entry.id,
      date: isoDate(startOfDay(entry.startAt)),
    });
  };

  const undoSkip = (entry: ScheduleEntry) => {
    if (!entry.skippedExceptionId) return;

    void removeException({
      id: entry.id,
      exceptionId: entry.skippedExceptionId,
    });
  };

  const remove = (entry: ScheduleEntry) => {
    Alert.alert("Delete entry", entry.title, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => void deleteSchedule(entry.id),
      },
    ]);
  };

  return (
    <Screen>
      <ScreenHeader kicker="SCHEDULE" onBack={() => router.back()} />

      {isError ? (
        <ErrorBanner
          message={
            typeof error === "string" ? error : "Schedule could not be loaded."
          }
        />
      ) : null}

      {isLoading ? (
        <Text style={styles.muted}>Loading schedule…</Text>
      ) : sections.length === 0 ? (
        <EmptyState
          title="Nothing scheduled."
          body="Add your first class or event below."
        />
      ) : (
        sections.map(section => (
          <View key={section.day} style={styles.section}>
            <Text style={styles.sectionTitle}>{formatDay(section.day)}</Text>

            {section.entries.map(entry => (
              <View key={entry.id} style={styles.row}>
                <View style={styles.rowCopy}>
                  <Text
                    style={[
                      styles.rowTitle,
                      entry.isSkipped ? styles.skippedText : null,
                    ]}
                    numberOfLines={2}
                  >
                    {entry.title}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {entry.allDay
                      ? "All day"
                      : formatRange(entry.startAt, entry.endAt)}
                    {entry.subject ? ` · ${entry.subject}` : ""}
                  </Text>
                  {entry.room || entry.teacher ? (
                    <Text style={styles.rowMeta}>
                      {entry.room ? `Room ${entry.room}` : ""}
                      {entry.room && entry.teacher ? " · " : ""}
                      {entry.teacher ? entry.teacher : ""}
                    </Text>
                  ) : null}
                  {entry.isSkipped ? (
                    <Text style={styles.skippedLabel}>Skipped</Text>
                  ) : null}
                </View>

                <View style={styles.rowActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      entry.isSkipped
                        ? `Undo skip for ${entry.title}`
                        : `Skip ${entry.title}`
                    }
                    onPress={() =>
                      entry.isSkipped ? undoSkip(entry) : skip(entry)
                    }
                    hitSlop={10}
                    style={({ pressed }) => [
                      styles.action,
                      pressed ? styles.pressed : null,
                    ]}
                  >
                    <Text style={styles.actionLabel}>
                      {entry.isSkipped ? "Undo" : "Skip"}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${entry.title}`}
                    onPress={() => startEdit(entry)}
                    hitSlop={10}
                    style={({ pressed }) => [
                      styles.action,
                      pressed ? styles.pressed : null,
                    ]}
                  >
                    <Text style={styles.actionLabel}>Edit</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${entry.title}`}
                    onPress={() => remove(entry)}
                    hitSlop={10}
                    style={({ pressed }) => [
                      styles.action,
                      pressed ? styles.pressed : null,
                    ]}
                  >
                    <Text style={[styles.actionLabel, styles.danger]}>
                      Delete
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ))
      )}

      <Card title={editingId ? "EDIT ENTRY" : "NEW ENTRY"}>
        <TextField
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder="Math lecture"
          autoCapitalize="words"
        />
        <TextField
          label="Date"
          value={datePart}
          onChangeText={setDatePart}
          placeholder={isoDate(new Date())}
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
        />
        {allDay ? null : (
          <TextField
            label="Start time"
            value={startTime}
            onChangeText={setStartTime}
            placeholder="09:00"
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
          />
        )}
        {allDay ? null : (
          <TextField
            label="End time"
            value={endTime}
            onChangeText={setEndTime}
            placeholder="10:00"
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
          />
        )}
        <TextField
          label="Subject"
          value={subject}
          onChangeText={setSubject}
          placeholder="Mathematics"
          autoCapitalize="words"
        />
        <TextField
          label="Room"
          value={room}
          onChangeText={setRoom}
          placeholder="B12"
          autoCapitalize="characters"
        />
        <TextField
          label="Teacher"
          value={teacher}
          onChangeText={setTeacher}
          placeholder="Ms. Alvarez"
          autoCapitalize="words"
        />
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: allDay }}
          accessibilityLabel="All day"
          onPress={() => setAllDay(value => !value)}
          style={({ pressed }) => [
            styles.toggle,
            pressed ? styles.pressed : null,
          ]}
        >
          <View style={[styles.toggleTrack, allDay ? styles.toggleOn : null]}>
            <View
              style={[styles.toggleKnob, allDay ? styles.toggleKnobOn : null]}
            />
          </View>
          <Text style={styles.toggleLabel}>All day</Text>
        </Pressable>
        {formError ? <ErrorBanner message={formError} /> : null}
        <Button
          label={editingId ? "Save changes" : "Add entry"}
          onPress={() => void submit()}
          loading={creating || updating}
        />
        {editingId ? (
          <Button label="Cancel edit" variant="ghost" onPress={reset} />
        ) : null}
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

const styles = StyleSheet.create({
  muted: {
    color: colors.textMuted,
    fontSize: 14,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
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
  rowCopy: {
    flex: 1,
    gap: 2,
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
  skippedText: {
    color: colors.textMuted,
    textDecorationLine: "line-through",
  },
  skippedLabel: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: "700",
  },
  rowActions: {
    gap: spacing.sm,
  },
  action: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  actionLabel: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "700",
  },
  danger: {
    color: colors.danger,
  },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  toggleTrack: {
    width: 44,
    height: 26,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  toggleOn: {
    borderColor: colors.accent,
    backgroundColor: "rgba(124, 227, 177, 0.14)",
  },
  toggleKnob: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.textMuted,
  },
  toggleKnobOn: {
    backgroundColor: colors.accent,
    transform: [{ translateX: 18 }],
  },
  toggleLabel: {
    color: colors.text,
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
