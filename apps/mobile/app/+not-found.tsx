import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { colors, spacing } from "@/theme";

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <Screen>
      <View style={styles.content}>
        <Text style={styles.code}>404</Text>
        <Text style={styles.title}>That screen is not here.</Text>
        <Text style={styles.body}>
          The link may be old, or the room moved. Head back to the start.
        </Text>
        <Button label="Go home" onPress={() => router.replace("/")} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.lg,
  },
  code: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 3,
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  body: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 23,
  },
});
