import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import {
  getDocumentAsync,
  type DocumentPickerResult,
} from "expo-document-picker";
import { useRouter } from "expo-router";
import { apiErrorMessage } from "@/api/errors";
import {
  useDeleteDocumentMutation,
  useDocumentsQuery,
  useUploadDocumentMutation,
} from "@/api/documents-api";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { StatusPill, type PillTone } from "@/components/StatusPill";
import { TextField } from "@/components/TextField";
import { relativeTime } from "@/lib/time";
import type { DocumentStatus, StudyDocument } from "@/types";
import { colors, radii, spacing } from "@/theme";

const statusTones: Record<DocumentStatus, PillTone> = {
  uploaded: "muted",
  processing: "warning",
  processed: "success",
  failed: "danger",
};

const statusLabels: Record<DocumentStatus, string> = {
  uploaded: "Uploaded",
  processing: "Processing",
  processed: "Processed",
  failed: "Failed",
};

const pickerTypes = ["application/pdf", "text/plain"];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;

  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;

  return `${(kb / 1024).toFixed(1)} MB`;
}

async function pickFile(): Promise<DocumentPickerResult | null> {
  try {
    return await getDocumentAsync({
      type: pickerTypes,
      copyToCacheDirectory: true,
    });
  } catch {
    return null;
  }
}

export default function DocumentsScreen() {
  const router = useRouter();

  const [subject, setSubject] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useDocumentsQuery();
  const [uploadDocument, { isLoading: uploading }] =
    useUploadDocumentMutation();
  const [deleteDocument] = useDeleteDocumentMutation();

  const documents = data ?? [];

  const chooseFile = async () => {
    setUploadError(null);

    const picked = await pickFile();

    if (!picked) {
      setUploadError("The file picker could not open on this device.");
      return;
    }

    if (picked.canceled) return;

    const asset = picked.assets[0];
    if (!asset) {
      setUploadError("The picker returned no file. Try again.");
      return;
    }

    const trimmedSubject = subject.trim();

    try {
      await uploadDocument({
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType ?? "application/octet-stream",
        ...(trimmedSubject ? { subject: trimmedSubject } : {}),
      }).unwrap();
      setSubject("");
    } catch (cause) {
      setUploadError(
        apiErrorMessage(cause, `Robo could not upload ${asset.name}.`)
      );
    }
  };

  const remove = (doc: StudyDocument) => {
    Alert.alert("Delete document", doc.originalName, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => void deleteDocument(doc.id),
      },
    ]);
  };

  return (
    <Screen>
      <ScreenHeader kicker="NOTES" onBack={() => router.back()} />

      {isError ? (
        <ErrorBanner
          message={
            typeof error === "string"
              ? error
              : "Your documents could not be loaded."
          }
        />
      ) : null}

      {uploadError ? <ErrorBanner message={uploadError} /> : null}

      {isLoading ? (
        <Text style={styles.muted}>Loading documents…</Text>
      ) : documents.length === 0 ? (
        <EmptyState
          title="No documents yet."
          body="Pick a PDF or text file below to add it to Robo's library."
        />
      ) : (
        <View style={styles.list}>
          {documents.map(doc => (
            <View key={doc.id} style={styles.row}>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle} numberOfLines={2}>
                  {doc.originalName}
                </Text>
                <Text style={styles.rowMeta}>
                  {formatSize(doc.size)}
                  {doc.mimeType ? ` · ${doc.mimeType}` : ""}
                  {doc.subject ? ` · ${doc.subject}` : ""}
                  {doc.chunkCount > 0 ? ` · ${doc.chunkCount} chunks` : ""}
                  {` · ${relativeTime(doc.createdAt)}`}
                </Text>
              </View>

              <StatusPill
                label={statusLabels[doc.status]}
                tone={statusTones[doc.status]}
              />

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete ${doc.originalName}`}
                onPress={() => remove(doc)}
                hitSlop={10}
              >
                <Text style={styles.remove}>✕</Text>
              </Pressable>
            </View>
          ))}

          <Text style={styles.caption}>
            Robo currently records the file details only — the bytes are not
            stored or searched, so status will not advance on its own.
          </Text>
        </View>
      )}

      <Card title="ADD A DOCUMENT">
        <TextField
          label="Subject for the next upload"
          value={subject}
          onChangeText={setSubject}
          placeholder="Biology notes"
          autoCapitalize="words"
        />
        <Button
          label="Choose file"
          onPress={() => void chooseFile()}
          loading={uploading}
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
  caption: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    paddingTop: spacing.xs,
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
