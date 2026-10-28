import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { apiErrorMessage } from "@/api/errors";
import {
  useCreateMemoryMutation,
  useDeleteMemoryMutation,
  useMemoriesQuery,
} from "@/api/memories-api";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { OptionList } from "@/components/OptionList";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { StatusPill, type PillTone } from "@/components/StatusPill";
import { TextField } from "@/components/TextField";
import type { Memory, MemoryCategory } from "@/types";
import { colors, spacing } from "@/theme";

const categoryOptions: { value: MemoryCategory; label: string }[] = [
  { value: "general", label: "General" },
  { value: "preference", label: "Preference" },
  { value: "fact", label: "Fact" },
  { value: "goal", label: "Goal" },
  { value: "study", label: "Study" },
];

const categoryTones: Record<string, PillTone> = {
  preference: "accentInk",
  fact: "muted",
  goal: "success",
  study: "warning",
  general: "muted",
};

function MemoryRow({ memory }: { memory: Memory }) {
  const [deleteMemory, { isLoading }] = useDeleteMemoryMutation();

  const remove = () => {
    Alert.alert("Forget memory", memory.content, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Forget",
        style: "destructive",
        onPress: () => void deleteMemory(memory.id),
      },
    ]);
  };

  return (
    <View style={styles.row}>
      <View style={styles.rowCopy}>
        <View style={styles.rowHead}>
          <StatusPill
            label={memory.category}
            tone={categoryTones[memory.category] ?? "muted"}
          />
        </View>
        <Text style={styles.rowTitle}>{memory.content}</Text>
      </View>
      <Button
        label="Forget"
        variant="ghost"
        onPress={remove}
        loading={isLoading}
      />
    </View>
  );
}

export default function MemoriesScreen() {
  const { data, isLoading, isError, error } = useMemoriesQuery();
  const [createMemory, { isLoading: saving }] = useCreateMemoryMutation();
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<MemoryCategory>("general");
  const [formError, setFormError] = useState<string | null>(null);

  const save = async () => {
    setFormError(null);
    if (!content.trim()) {
      setFormError("Write something for Robo to remember.");
      return;
    }

    try {
      await createMemory({ content: content.trim(), category }).unwrap();
      setContent("");
      setCategory("general");
    } catch (e) {
      setFormError(apiErrorMessage(e, "Robo could not save that memory."));
    }
  };

  return (
    <Screen>
      <ScreenHeader kicker="MEMORY" />
      <Text style={styles.intro}>What Robo remembers</Text>
      <Text style={styles.muted}>
        Preferences, goals and study details you asked Robo to keep.
      </Text>

      <Card title="ADD A MEMORY">
        <TextField
          label="Memory"
          value={content}
          onChangeText={setContent}
          placeholder="I prefer examples before definitions"
          multiline
          maxLength={1000}
        />
        <OptionList
          label="Category"
          options={categoryOptions}
          value={category}
          onChange={value => setCategory(value as MemoryCategory)}
        />
        {formError ? <ErrorBanner message={formError} /> : null}
        <Button
          label="Save memory"
          onPress={() => void save()}
          loading={saving}
        />
      </Card>

      {isError ? (
        <ErrorBanner
          message={apiErrorMessage(error, "Could not load your memories.")}
        />
      ) : null}

      {isLoading ? (
        <Text style={styles.muted}>Loading memories…</Text>
      ) : !data || data.length === 0 ? (
        <EmptyState
          title="Nothing saved yet."
          body="Tell Robo to remember a preference, goal or study detail."
        />
      ) : (
        <Card title="SAVED">
          {data.map(memory => (
            <MemoryRow key={memory.id} memory={memory} />
          ))}
        </Card>
      )}
    </Screen>
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
  row: {
    alignItems: "flex-start",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  rowCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  rowHead: {
    alignItems: "flex-start",
  },
  rowTitle: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
  },
});
