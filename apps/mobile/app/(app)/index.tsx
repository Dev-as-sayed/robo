import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { signOut } from "@/features/auth/session";
import { useAppDispatch, useAppSelector } from "@/store";
import { colors, radii, spacing } from "@/theme";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const cards = [
  {
    letter: "A",
    title: "Ask Robo",
    body: "Voice conversations are being connected in the next milestone.",
  },
  {
    letter: "T",
    title: "Today",
    body: "Classes, tasks, and reminders will show up here as you add them.",
  },
  {
    letter: "D",
    title: "Devices",
    body: "Pair the desktop speaker to talk to Robo hands-free.",
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector(state => state.auth.user);

  if (!user) {
    return null;
  }

  const firstName = user.name?.split(" ")[0] || "there";

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.brand}>ROBO</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void dispatch(signOut())}
          hitSlop={12}
        >
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>

      <View style={styles.greeting}>
        <Text style={styles.hello}>
          {greeting()}, {firstName}.
        </Text>
        <Text style={styles.subtitle}>
          Your day is quiet for now. Here is where it will come together.
        </Text>
      </View>

      <View style={styles.status}>
        <View style={styles.statusDot} />
        <View style={styles.statusCopy}>
          <Text style={styles.statusTitle}>Voice setup in progress</Text>
          <Text style={styles.statusBody}>
            Chat, speech, and the paired speaker are next on the roadmap.
          </Text>
        </View>
      </View>

      <View style={styles.cards}>
        {cards.map(card => (
          <View key={card.title} style={styles.card}>
            <View style={styles.cardMark}>
              <Text style={styles.cardLetter}>{card.letter}</Text>
            </View>
            <View style={styles.cardCopy}>
              <Text style={styles.cardTitle}>{card.title}</Text>
              <Text style={styles.cardBody}>{card.body}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.account}>
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.accountRow}>
          <Text style={styles.accountKey}>Email</Text>
          <Text style={styles.accountValue}>{user.email}</Text>
        </View>
        <View style={styles.accountRow}>
          <Text style={styles.accountKey}>Language</Text>
          <Text style={styles.accountValue}>
            {user.locale.startsWith("hi") ? "Hindi" : "English"}
          </Text>
        </View>
        <View style={styles.accountRow}>
          <Text style={styles.accountKey}>Time zone</Text>
          <Text style={styles.accountValue}>{user.timezone}</Text>
        </View>
        <Button
          label="Edit preferences"
          onPress={() => router.push("/onboarding")}
          variant="ghost"
          style={styles.editButton}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 3,
  },
  signOut: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
  greeting: {
    gap: spacing.sm,
    paddingTop: spacing.lg,
  },
  hello: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 23,
  },
  status: {
    flexDirection: "row",
    gap: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(124, 227, 177, 0.3)",
    backgroundColor: "rgba(124, 227, 177, 0.08)",
    padding: spacing.lg,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginTop: 5,
  },
  statusCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  statusTitle: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "700",
  },
  statusBody: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  cards: {
    gap: spacing.md,
  },
  card: {
    flexDirection: "row",
    gap: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  cardMark: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceRaised,
  },
  cardLetter: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: "800",
  },
  cardCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  cardBody: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  account: {
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.8,
  },
  accountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.md,
  },
  accountKey: {
    color: colors.textMuted,
    fontSize: 14,
  },
  accountValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "right",
  },
  editButton: {
    marginTop: spacing.sm,
  },
});
