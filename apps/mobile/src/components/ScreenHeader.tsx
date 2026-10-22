import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "@/theme";

interface ScreenHeaderProps {
  kicker: string;
  onBack?: () => void;
  right?: ReactNode;
}

export function ScreenHeader({ kicker, onBack, right }: ScreenHeaderProps) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable accessibilityRole="button" onPress={onBack} hitSlop={12}>
          <Text style={styles.back}>Back</Text>
        </Pressable>
      ) : (
        <View style={styles.spacer} />
      )}
      <Text style={styles.kicker}>{kicker}</Text>
      {right ?? <View style={styles.spacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  kicker: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
  },
  back: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: "600",
    width: 56,
  },
  spacer: {
    width: 56,
  },
});
