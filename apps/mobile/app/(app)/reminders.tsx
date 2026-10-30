import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { t } from "@/i18n";
import { useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { OptionList, type Option } from "@/components/OptionList";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { StatusPill, type PillTone } from "@/components/StatusPill";
import { TextField } from "@/components/TextField";
import {
  useCreateReminderMutation,
  useDeleteReminderMutation,
  useRemindersQuery,
  useSnoozeReminderMutation,
} from "@/api/reminders-api";
import { isoDate, parseDateTime, relativeTime } from "@/lib/time";
import type { Reminder, ReminderChannel, ReminderStatus } from "@/types";
import { colors, radii, spacing } from "@/theme";

const statusTones: Record<ReminderStatus, PillTone> = {
  active: "success",
  snoozed: "warning",
  completed: "muted",
  expired: "danger",
};

const filters: { value: ReminderStatus | "all"; label: string }[] = [
  { value: "active", label: t("reminders.title") },
  { value: "snoozed", label: t("reminders.snooze") },
  { value: "completed", label: t("app.empty_state") },
  { value: "all", label: t("app.empty_state") },
];

const channels: ReminderChannel[] = ["device", "phone", "push"];

const channelLabels: Record<ReminderChannel, string> = {
  device: t("device"),
  phone: t("phone"),
  push: t("push"),
};

const linkedOptions: Option<"none" | "todo" | "exam" | "schedule">[] = [
  { value: "none", label: t("none") },
  { value: "todo", label: t("todo") },
  { value: "exam", label: t("exam") },
  { value: "schedule", label: t("schedule") },
];

/**
 * Only rules the server can evaluate are offered. The weekday set is the one pattern
 * the reminder engine supports beyond a plain weekly repeat.
 */
const repeatOptions: Option<string>[] = [
  { value: "none", label: "Once" },
  { value: "FREQ=DAILY", label: "Every day" },
  { value: "FREQ=WEEKLY", label: "Same day each week" },
  { value: "FREQ=WEEKLY;BYDAY=MO,WE,FR", label: "Mon, Wed, Fri" },
  { value: "FREQ=MONTHLY", label: "Same day each month" },
];

function repeatLabel(rrule: string | null): string | null {
  if (!rrule) return null;
  return (
    repeatOptions.find(option => option.value === rrule)?.label ?? "Repeats"
  );
}

export default function RemindersScreen() {
  const router = useRouter();

  const [filter, setFilter] = useState<ReminderStatus | "all">("active");
  const [text, setText] = useState("");
  const [datePart, setDatePart] = useState("");
  const [timePart, setTimePart] = useState("");
  const [linked, setLinked] = useState<"none" | "todo" | "exam" | "schedule">(
    "none"
  );
  const [repeat, setRepeat] = useState("none");
  const [picked, setPicked] = useState<ReminderChannel[]>(["device"]);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useRemindersQuery();
  const [createReminder, { isLoading: creating }] = useCreateReminderMutation();
  const [snoozeReminder] = useSnoozeReminderMutation();
  const [deleteReminder] = useDeleteReminderMutation();

  const reminders = (data ?? []).filter(
    reminder => filter === "all" || reminder.status === filter
  );

  const reset = () => {
    setText("");
    setDatePart("");
    setTimePart("");
    setLinked("none");
    setRepeat("none");
    setPicked(["device"]);
    setFormError(null);
  };

  const toggleChannel = (channel: ReminderChannel) => {
    setPicked(current =>
      current.includes(channel)
        ? current.filter(item => item !== channel)
        : [...current, channel]
    );
  };

  const submit = async () => {
    if (!text.trim()) {
      setFormError("Write what Robo should remind you about.");
      return;
    }

    if (picked.length === 0) {
      setFormError("Pick at least one channel.");
      return;
    }

    let at: string | undefined;

    if (datePart.trim()) {
      const parsed = parseDateTime(datePart, timePart.trim() || undefined);
      if (!parsed) {
        setFormError("Use a date like 2026-10-30 and a time like 18:00.");
        return;
      }
      at = parsed;
    }

    if (repeat !== "none" && !at) {
      setFormError("A repeating reminder needs a first date and time.");
      return;
    }

    try {
      await createReminder({
        text: text.trim(),
        channels: picked,
        ...(at ? { at } : {}),
        ...(repeat === "none" ? {} : { rrule: repeat }),
        ...(linked === "none" ? {} : { linkedEntity: linked }),
      }).unwrap();
      reset();
    } catch {
      setFormError("Robo could not save that reminder. Try again.");
    }
  };

  const remove = (reminder: Reminder) => {
    Alert.alert("Delete reminder", reminder.text, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => void deleteReminder(reminder.id),
      },
    ]);
  };

  return (
    <Screen>
      <ScreenHeader kicker="REMINDERS" onBack={() => router.back()} />

      <OptionList
        label="Show"
        value={filter}
        options={filters}
        onChange={setFilter}
      />

      {isError ? (
        <ErrorBanner
          message={
            typeof error === "string" ? error : "Reminders could not be loaded."
          }
        />
      ) : null}

      {isLoading ? (
        <Text style={styles.muted}>Loading reminders…</Text>
      ) : reminders.length === 0 ? (
        <EmptyState
          title="Nothing here."
          body="Add a reminder below, or ask Robo in chat."
        />
      ) : (
        reminders.map(reminder => (
          <View key={reminder.id} style={styles.row}>
            <View style={styles.rowCopy}>
              <Text
                style={[
                  styles.rowTitle,
                  reminder.status === "completed" ? styles.rowTitleDone : null,
                ]}
                numberOfLines={2}
              >
                {reminder.text}
              </Text>
              <Text style={styles.rowMeta}>
                {reminder.at ? `${relativeTime(reminder.at)}` : "No time set"}
                {repeatLabel(reminder.rrule)
                  ? ` · ${repeatLabel(reminder.rrule)}`
                  : ""}
                {reminder.linkedEntity ? ` · ${reminder.linkedEntity}` : ""}
              </Text>
              <Text style={styles.rowChannels}>
                {reminder.channels
                  .map(channel => channelLabels[channel])
                  .join(" · ")}
              </Text>
            </View>

            <StatusPill
              label={reminder.status}
              tone={statusTones[reminder.status]}
            />

            <View style={styles.rowActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Snooze ${reminder.text}`}
                onPress={() => void snoozeReminder(reminder.id)}
                hitSlop={10}
                style={({ pressed }) => [
                  styles.action,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Text style={styles.actionLabel}>Snooze</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete ${reminder.text}`}
                onPress={() => remove(reminder)}
                hitSlop={10}
                style={({ pressed }) => [
                  styles.action,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Text style={[styles.actionLabel, styles.danger]}>Delete</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}

      <Card title="ADD REMINDER">
        <TextField
          label="Text"
          value={text}
          onChangeText={setText}
          placeholder="Review flashcards before bed"
          autoCapitalize="sentences"
          multiline
        />
        <TextField
          label="Date"
          value={datePart}
          onChangeText={setDatePart}
          placeholder={isoDate(new Date())}
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
        />
        <TextField
          label="Time"
          value={timePart}
          onChangeText={setTimePart}
          placeholder="18:00"
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
        />
        <OptionList
          label="Linked to"
          value={linked}
          options={linkedOptions}
          onChange={setLinked}
        />
        <OptionList
          label="Repeats"
          value={repeat}
          options={repeatOptions}
          onChange={setRepeat}
        />
        <View style={styles.channelGroup}>
          <Text style={styles.channelLabel}>Channels</Text>
          <View style={styles.chips}>
            {channels.map(channel => {
              const active = picked.includes(channel);

              return (
                <Pressable
                  key={channel}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={`Channel ${channelLabels[channel]}`}
                  onPress={() => toggleChannel(channel)}
                  style={[styles.chip, active ? styles.chipActive : null]}
                >
                  <Text
                    style={[
                      styles.chipLabel,
                      active ? styles.chipLabelActive : null,
                    ]}
                  >
                    {channelLabels[channel]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        {formError ? <ErrorBanner message={formError} /> : null}
        <Button
          label="Add reminder"
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
  rowChannels: {
    color: colors.textMuted,
    fontSize: 11,
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
  channelGroup: {
    gap: spacing.sm,
  },
  channelLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: "rgba(124, 227, 177, 0.14)",
  },
  chipLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  chipLabelActive: {
    color: colors.accent,
    fontWeight: "800",
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
