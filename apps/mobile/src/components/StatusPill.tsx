import { StyleSheet, Text, View } from "react-native";
import { radii, spacing } from "@/theme";

const tones = {
  success: "#7CE3B1",
  warning: "#F2C46D",
  danger: "#FF7A7A",
  muted: "#93A4B8",
  accentInk: "#042116",
} as const;

export type PillTone = keyof typeof tones;

export function StatusPill({
  label,
  tone = "muted",
}: {
  label: string;
  tone?: PillTone;
}) {
  return (
    <View
      style={[
        styles.pill,
        { borderColor: tones[tone], backgroundColor: `${tones[tone]}1A` },
      ]}
    >
      <Text style={[styles.label, { color: tones[tone] }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
});
