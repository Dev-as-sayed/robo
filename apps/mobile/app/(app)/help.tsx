import { useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SUPPORT_EMAIL, SUPPORT_URL } from "@/config";
import { colors, radii, spacing } from "@/theme";

interface Faq {
  id: string;
  question: string;
  answer: string;
}

const faqs: Faq[] = [
  {
    id: "reminders",
    question: "How do I add a task or reminder?",
    answer:
      "Open Tasks to add something you need to finish, or Reminders to schedule something at a time. You can also ask Robo in Chat, for example: “Remind me to revise physics at 7 pm.” Robo asks for confirmation before creating it.",
  },
  {
    id: "voice",
    question: "Why does Robo need the microphone?",
    answer:
      "The microphone is only used while you are talking to Robo or using voice input. You can withdraw microphone consent at any time in Settings, Privacy & Consent.",
  },
  {
    id: "contacts",
    question: "Why does Robo ask for contacts?",
    answer:
      "Contacts are optional. Robo reads only the contact you choose in your phone's contact picker when you ask it to help with a call, SMS or WhatsApp message. You can review the details before saving, add a contact manually, and remove saved contacts in Contacts.",
  },
  {
    id: "report",
    question: "How do I report a bad AI answer?",
    answer:
      "Tap Report under any chat answer or vision explanation, choose a reason, and send it. Reports go to the Robo team for review. Do not include passwords or other secrets in the optional details.",
  },
  {
    id: "data",
    question: "How do I export or delete my data?",
    answer:
      "Go to Settings, Data to export a JSON copy of your data. Settings, Danger Zone can delete your account and everything linked to it. Deletion is permanent and also removes devices, documents, chats and consent records.",
  },
  {
    id: "cloud",
    question: "Are my documents sent to the cloud?",
    answer:
      "Only when you enable Cloud AI for documents in Settings. With Cloud AI off, document questions use the local model when one is configured. You can change this at any time.",
  },
  {
    id: "device",
    question: "My Robo device is not connecting.",
    answer:
      "Open Devices and check that the device shows as online. Make sure the device and phone are on the same Wi-Fi network, then try reconnecting. If it still fails, remove the device and pair it again.",
  },
  {
    id: "offline",
    question: "Does Robo work offline?",
    answer:
      "The app keeps recently loaded tasks, reminders and schedule information visible, and reminders already on your phone can still ring. New AI answers, imports and cloud document questions need a connection.",
  },
];

function FaqRow({
  item,
  open,
  onToggle,
}: {
  item: Faq;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.faqRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={item.question}
        onPress={onToggle}
        style={({ pressed }) => [styles.faqHead, pressed ? styles.pressed : null]}
      >
        <Text style={styles.faqQuestion}>{item.question}</Text>
        <Text style={styles.faqMark}>{open ? "−" : "+"}</Text>
      </Pressable>
      {open ? <Text style={styles.faqAnswer}>{item.answer}</Text> : null}
    </View>
  );
}

async function openSupport() {
  const url = SUPPORT_EMAIL
    ? `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Robo support")}`
    : SUPPORT_URL;

  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      throw new Error("unsupported");
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert(
      "Could not open support",
      SUPPORT_EMAIL
        ? `Email ${SUPPORT_EMAIL} from your mail app.`
        : "Open the Robo issue tracker from a browser."
    );
  }
}

export default function HelpScreen() {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>("reminders");

  return (
    <Screen>
      <ScreenHeader kicker="HELP & FAQ" onBack={() => router.back()} />
      <Card title="QUICK ANSWERS" tone="accent">
        <Text style={styles.lead}>
          Short answers about setup, privacy and everyday use. Still stuck?
          Send us the details and we will take a look.
        </Text>
        <Button label="Contact support" onPress={() => void openSupport()} />
      </Card>
      <Card title="COMMON QUESTIONS">
        {faqs.map(item => (
          <FaqRow
            key={item.id}
            item={item}
            open={openId === item.id}
            onToggle={() => setOpenId(current => (current === item.id ? null : item.id))}
          />
        ))}
      </Card>
      <Card title="BEFORE YOU CONTACT US">
        <Text style={styles.hint}>
          Include your account email, the phone model and what you expected to
          happen. For AI mistakes, use Report on the answer so the team can see
          the exact response. Never send your password or API keys.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  faqRow: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  faqHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    minHeight: 40,
  },
  faqQuestion: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
  },
  faqMark: {
    color: colors.accent,
    fontSize: 22,
    fontWeight: "700",
    width: 24,
    textAlign: "center",
  },
  faqAnswer: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.sm,
    padding: spacing.md,
  },
  pressed: {
    opacity: 0.82,
  },
});
