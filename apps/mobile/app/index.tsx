import { Redirect, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { useAppSelector } from "@/store";
import { colors, radii, spacing } from "@/theme";

const features = [
  {
    index: "01",
    title: "Talk it through",
    body: "Ask Robo a question out loud and hear the answer back.",
  },
  {
    index: "02",
    title: "Keep your day straight",
    body: "Classes, tasks, and reminders in one calm place.",
  },
  {
    index: "03",
    title: "Know what is next",
    body: "A quick nudge before the thing you almost forgot.",
  },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const user = useAppSelector(state => state.auth.user);

  if (user) {
    return <Redirect href="/(app)" />;
  }

  return (
    <Screen>
      <View style={styles.topRow}>
        <Text style={styles.kicker}>STUDY COMPANION</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>BETA</Text>
        </View>
      </View>

      <View style={styles.hero}>
        <Text style={styles.wordmark}>Robo</Text>
        <Text style={styles.title}>Your day,{"\n"}handled.</Text>
        <Text style={styles.subtitle}>
          A voice-first assistant for classes, homework, and everything in
          between.
        </Text>
      </View>

      <View style={styles.features}>
        {features.map(feature => (
          <View key={feature.index} style={styles.featureRow}>
            <Text style={styles.featureIndex}>{feature.index}</Text>
            <View style={styles.featureCopy}>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureBody}>{feature.body}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <Button
          label="Create an account"
          onPress={() => router.push("/sign-up")}
        />
        <Button
          label="I already have an account"
          onPress={() => router.push("/sign-in")}
          variant="ghost"
        />
        <Text style={styles.footnote}>
          Built for students. Your voice stays yours.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  kicker: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2.4,
  },
  badge: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.4,
  },
  hero: {
    gap: spacing.md,
    paddingTop: spacing.xl,
  },
  wordmark: {
    color: colors.accent,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  title: {
    color: colors.text,
    fontSize: 44,
    fontWeight: "800",
    letterSpacing: -1.2,
    lineHeight: 48,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 17,
    lineHeight: 25,
    maxWidth: 330,
  },
  features: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  featureRow: {
    flexDirection: "row",
    gap: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  featureIndex: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    paddingTop: 3,
  },
  featureCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  featureTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  featureBody: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    gap: spacing.md,
    marginTop: "auto",
  },
  footnote: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: "center",
    paddingTop: spacing.xs,
  },
});
