import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "@/theme";

interface CardProps {
  title?: string;
  right?: ReactNode;
  tone?: "default" | "accent";
  children: ReactNode;
}

export function Card({ title, right, tone = "default", children }: CardProps) {
  return (
    <View
      style={[styles.card, tone === "accent" ? styles.cardAccent : null]}
    >
      {title || right ? (
        <View style={styles.head}>
          {title ? <Text style={styles.title}>{title}</Text> : <View />}
          {right}
        </View>
      ) : null}
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardAccent: {
    borderColor: "rgba(124, 227, 177, 0.3)",
    backgroundColor: "rgba(124, 227, 177, 0.08)",
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  body: {
    gap: spacing.md,
  },
});
