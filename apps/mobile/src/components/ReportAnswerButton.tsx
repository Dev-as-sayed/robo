import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text } from "react-native";
import {
  useSubmitAiFeedbackMutation,
  type AiFeedbackInput,
  type AiFeedbackReason,
} from "@/api/chat-api";
import { colors, spacing } from "@/theme";

interface ReportAnswerButtonProps {
  surface: AiFeedbackInput["surface"];
  messageId?: string;
  responseText?: string;
}

export function ReportAnswerButton({
  surface,
  messageId,
  responseText,
}: ReportAnswerButtonProps) {
  const [submit, { isLoading }] = useSubmitAiFeedbackMutation();
  const [reported, setReported] = useState(false);

  const report = async (reason: AiFeedbackReason) => {
    try {
      await submit({
        surface,
        reason,
        ...(messageId ? { messageId } : {}),
        ...(responseText ? { responseText: responseText.slice(0, 4000) } : {}),
      }).unwrap();
      setReported(true);
      Alert.alert("Report received", "Thanks. We will review this answer.");
    } catch {
      Alert.alert(
        "Could not send report",
        "Check your connection and try again."
      );
    }
  };

  const chooseReason = () => {
    Alert.alert(
      "Report this answer",
      "What is wrong with it?",
      [
        {
          text: "Offensive or unsafe",
          onPress: () => void report("OFFENSIVE"),
        },
        {
          text: "Incorrect or unhelpful",
          onPress: () => void report("INCORRECT"),
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  if (reported) {
    return <Text style={styles.reported}>Reported</Text>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Report this answer"
      disabled={isLoading}
      onPress={chooseReason}
      hitSlop={8}
      style={({ pressed }) => [
        styles.button,
        pressed ? styles.pressed : null,
      ]}
    >
      <Text style={styles.label}>{isLoading ? "Sending..." : "Report"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: "flex-start",
    marginTop: spacing.sm,
  },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  pressed: {
    opacity: 0.6,
  },
  reported: {
    alignSelf: "flex-start",
    marginTop: spacing.sm,
    color: colors.accent,
    fontSize: 11,
    fontWeight: "700",
  },
});
