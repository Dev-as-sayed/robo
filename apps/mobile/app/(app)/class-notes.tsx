import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { apiErrorMessage } from "@/api/errors";
import {
  useClassNotesQuery,
  useCreateClassNoteMutation,
  useDeleteClassNoteMutation,
} from "@/api/class-notes-api";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { TextField } from "@/components/TextField";
import type { ClassNote } from "@/types";
import { formatDayTime } from "@/lib/time";
import { colors, spacing } from "@/theme";

function NoteRow({ note }: { note: ClassNote }) {
  const [deleteNote, { isLoading }] = useDeleteClassNoteMutation();

  const remove = () => {
    Alert.alert("Delete class note", note.title, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => void deleteNote(note.id),
      },
    ]);
  };

  return (
    <View style={styles.row}>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{note.title}</Text>
        <Text style={styles.rowMeta}>
          {[note.subject, formatDayTime(note.classAt)].filter(Boolean).join(" · ")}
        </Text>
        <Text style={styles.rowBody}>{note.content}</Text>
      </View>
      <Button
        label="Delete"
        variant="ghost"
        onPress={remove}
        loading={isLoading}
      />
    </View>
  );
}

export default function ClassNotesScreen() {
  const { data, isLoading, isError, error } = useClassNotesQuery();
  const [createNote, { isLoading: saving }] = useCreateClassNoteMutation();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const save = async () => {
    setFormError(null);
    if (!title.trim() || !content.trim()) {
      setFormError("Add a title and what you learned.");
      return;
    }

    try {
      await createNote({
        title: title.trim(),
        content: content.trim(),
        ...(subject.trim() ? { subject: subject.trim() } : {}),
        classAt: new Date().toISOString(),
      }).unwrap();
      setTitle("");
      setSubject("");
      setContent("");
    } catch (e) {
      setFormError(apiErrorMessage(e, "Robo could not save that note."));
    }
  };

  return (
    <Screen>
      <ScreenHeader kicker="CLASS NOTES" />
      <Text style={styles.intro}>What stuck today?</Text>
      <Text style={styles.muted}>
        Capture the lecture while it is fresh. Robo also asks after class.
      </Text>

      <Card title="NEW NOTE">
        <TextField
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder="Physics 101"
        />
        <TextField
          label="Subject"
          value={subject}
          onChangeText={setSubject}
          placeholder="Physics"
        />
        <TextField
          label="Notes"
          value={content}
          onChangeText={setContent}
          placeholder="Refraction is the bending of light…"
          multiline
          maxLength={10000}
        />
        {formError ? <ErrorBanner message={formError} /> : null}
        <Button label="Save note" onPress={() => void save()} loading={saving} />
      </Card>

      {isError ? (
        <ErrorBanner
          message={apiErrorMessage(error, "Could not load your class notes.")}
        />
      ) : null}

      {isLoading ? (
        <Text style={styles.muted}>Loading notes…</Text>
      ) : !data || data.length === 0 ? (
        <EmptyState
          title="No class notes yet."
          body="Save one after your next lecture or let Robo prompt you."
        />
      ) : (
        <Card title="RECENT">
          {data.map(note => (
            <NoteRow key={note.id} note={note} />
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
  rowTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  rowMeta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  rowBody: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
});
