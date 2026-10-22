import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "@/theme";

export function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: "rgba(255, 122, 122, 0.4)",
    backgroundColor: "rgba(255, 122, 122, 0.1)",
    padding: spacing.md,
  },
  text: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
  },
});
