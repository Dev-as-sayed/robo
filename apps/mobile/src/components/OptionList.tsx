import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "@/theme";

export interface Option<T extends string> {
  value: T;
  label: string;
}

interface OptionListProps<T extends string> {
  label?: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function OptionList<T extends string>({
  label,
  options,
  value,
  onChange,
}: OptionListProps<T>) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.chips}>
        {options.map(option => {
          const active = option.value === value;

          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              onPress={() => onChange(option.value)}
              style={[styles.chip, active ? styles.chipActive : null]}
            >
              <Text
                style={[styles.chipLabel, active ? styles.chipLabelActive : null]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  label: {
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
});
