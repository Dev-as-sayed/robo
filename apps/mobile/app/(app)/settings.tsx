import { useState } from "react";
import { Alert, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { OptionList } from "@/components/OptionList";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { StatusPill, type PillTone } from "@/components/StatusPill";
import { TextField } from "@/components/TextField";
import { apiErrorMessage } from "@/api/errors";
import { useMeQuery, useUpdateMeMutation } from "@/api/auth-api";
import {
  useConsentsQuery,
  useDeleteAccountMutation,
  useExportDataMutation,
  useUpdateConsentMutation,
} from "@/api/account-api";
import { signOut } from "@/features/auth/session";
import { useAppDispatch, useAppSelector } from "@/store";
import type {
  AccountPreferences,
  ConsentKind,
  NudgeSettings,
  User,
  WakePhrase,
} from "@/types";
import { colors, radii, spacing } from "@/theme";

const wakePhrases: { value: WakePhrase; label: string }[] = [
  { value: "hey robo", label: "Hey Robo" },
  { value: "ok robo", label: "Ok Robo" },
  { value: "hello robo", label: "Hello Robo" },
];

const nudgeTypeOptions: { key: keyof NudgeSettings["types"]; label: string }[] =
  [
    { key: "reminders", label: "Reminders" },
    { key: "study", label: "Study" },
    { key: "exams", label: "Exams" },
    { key: "tasks", label: "Tasks" },
  ];

function toWakePhrase(value: string): WakePhrase {
  const hit = wakePhrases.find(option => option.value === value);
  return hit ? hit.value : "hey robo";
}

function isValidClock(value: string): boolean {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return false;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours <= 23 && minutes <= 59;
}

function statusTone(status: string): PillTone {
  return status === "ACTIVE" ? "success" : "danger";
}

interface ToggleRowProps {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  role?: "switch" | "checkbox";
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  role = "switch",
}: ToggleRowProps) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={{ checked }}
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [
        styles.toggleRow,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.toggleCopy}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {hint ? <Text style={styles.toggleHint}>{hint}</Text> : null}
      </View>
      <View style={[styles.switchTrack, checked ? styles.switchOn : null]}>
        <View
          style={[styles.switchKnob, checked ? styles.switchKnobOn : null]}
        />
      </View>
    </Pressable>
  );
}

function IdentitySection({ user }: { user: User }) {
  const [name, setName] = useState(user.name ?? "");
  const [locale, setLocale] = useState(user.locale);
  const [timezone, setTimezone] = useState(user.timezone);
  const [formError, setFormError] = useState<string | null>(null);
  const [updateMe, { isLoading }] = useUpdateMeMutation();

  const trimmedName = name.trim();
  const trimmedLocale = locale.trim();
  const trimmedTimezone = timezone.trim();

  const patch: AccountPreferences = {};
  if (trimmedName && trimmedName !== (user.name ?? "")) {
    patch.name = trimmedName;
  }
  if (trimmedLocale && trimmedLocale !== user.locale) {
    patch.locale = trimmedLocale;
  }
  if (trimmedTimezone && trimmedTimezone !== user.timezone) {
    patch.timezone = trimmedTimezone;
  }

  const dirty = Object.keys(patch).length > 0;

  const save = async () => {
    setFormError(null);
    if (patch.name !== undefined && patch.name.length < 2) {
      setFormError("Name needs at least 2 characters.");
      return;
    }
    try {
      await updateMe(patch).unwrap();
    } catch (e) {
      setFormError(
        apiErrorMessage(e, "Could not save your details. Try again.")
      );
    }
  };

  return (
    <Card title="IDENTITY">
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Signed in as</Text>
        <Text style={styles.metaValue}>{user.email}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Account</Text>
        <Text style={styles.metaValue}>{user.role}</Text>
        <StatusPill label={user.status} tone={statusTone(user.status)} />
      </View>

      <TextField
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="Your name"
        autoCapitalize="words"
        autoComplete="name"
      />
      <TextField
        label="Language"
        value={locale}
        onChangeText={setLocale}
        placeholder="en"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={styles.hint}>Matches onboarding: en or hi.</Text>
      <TextField
        label="Time zone"
        value={timezone}
        onChangeText={setTimezone}
        placeholder="Asia/Kolkata"
        autoCapitalize="none"
        autoCorrect={false}
      />

      {formError ? <ErrorBanner message={formError} /> : null}

      <Button
        label="Save details"
        onPress={() => void save()}
        loading={isLoading}
        disabled={!dirty}
      />
    </Card>
  );
}

function QuietHoursSection({ user }: { user: User }) {
  const initial = user.quietHours;
  const [enabled, setEnabled] = useState(initial?.enabled ?? false);
  const [start, setStart] = useState(initial?.start ?? "22:00");
  const [end, setEnd] = useState(initial?.end ?? "07:00");
  const [formError, setFormError] = useState<string | null>(null);
  const [updateMe, { isLoading }] = useUpdateMeMutation();

  const save = async () => {
    setFormError(null);

    if (enabled && (!isValidClock(start) || !isValidClock(end))) {
      setFormError("Use 24-hour times like 22:00 and 07:00.");
      return;
    }

    const payload: AccountPreferences = {
      quietHours: enabled
        ? { enabled: true, start: start.trim(), end: end.trim() }
        : null,
    };

    try {
      await updateMe(payload).unwrap();
    } catch (e) {
      setFormError(apiErrorMessage(e, "Could not save quiet hours."));
    }
  };

  return (
    <Card title="QUIET HOURS">
      <ToggleRow
        label="Quiet hours"
        hint="Silence Robo on this device during the window."
        checked={enabled}
        onChange={setEnabled}
      />
      {enabled ? (
        <View style={styles.inlineFields}>
          <TextField
            label="Start"
            value={start}
            onChangeText={setStart}
            placeholder="22:00"
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
          />
          <TextField
            label="End"
            value={end}
            onChangeText={setEnd}
            placeholder="07:00"
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
          />
        </View>
      ) : (
        <Text style={styles.hint}>
          Off. Saving will clear quiet hours on your account.
        </Text>
      )}
      {formError ? <ErrorBanner message={formError} /> : null}
      <Button
        label="Save quiet hours"
        onPress={() => void save()}
        loading={isLoading}
      />
    </Card>
  );
}

function WakePhraseSection({ user }: { user: User }) {
  const initial = toWakePhrase(user.wakePhrase);
  const [phrase, setPhrase] = useState<WakePhrase>(initial);
  const [formError, setFormError] = useState<string | null>(null);
  const [updateMe, { isLoading }] = useUpdateMeMutation();

  const save = async () => {
    setFormError(null);
    try {
      await updateMe({ wakePhrase: phrase }).unwrap();
    } catch (e) {
      setFormError(apiErrorMessage(e, "Could not save wake phrase."));
    }
  };

  return (
    <Card title="WAKE PHRASE">
      <OptionList
        label="Say this to start listening"
        value={phrase}
        options={wakePhrases}
        onChange={setPhrase}
      />
      {formError ? <ErrorBanner message={formError} /> : null}
      <Button
        label="Save wake phrase"
        onPress={() => void save()}
        loading={isLoading}
        disabled={phrase === initial}
      />
    </Card>
  );
}

function NudgesSection({ user }: { user: User }) {
  const initial = user.nudgeSettings;
  const [enabled, setEnabled] = useState(initial?.enabled ?? false);
  const [maxPerDay, setMaxPerDay] = useState(String(initial?.maxPerDay ?? 3));
  const [types, setTypes] = useState<NudgeSettings["types"]>({
    reminders: initial?.types.reminders ?? true,
    study: initial?.types.study ?? true,
    exams: initial?.types.exams ?? false,
    tasks: initial?.types.tasks ?? true,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [updateMe, { isLoading }] = useUpdateMeMutation();

  const save = async () => {
    setFormError(null);
    const parsed = Number(maxPerDay.trim());
    if (
      !Number.isFinite(parsed) ||
      !Number.isInteger(parsed) ||
      parsed < 0 ||
      parsed > 20
    ) {
      setFormError("Max per day must be a whole number between 0 and 20.");
      return;
    }

    const payload: AccountPreferences = {
      nudgeSettings: { enabled, maxPerDay: parsed, types },
    };

    try {
      await updateMe(payload).unwrap();
    } catch (e) {
      setFormError(apiErrorMessage(e, "Could not save nudge settings."));
    }
  };

  return (
    <Card title="NUDGES">
      <ToggleRow
        label="Proactive nudges"
        hint="Opt in to occasional reminders about tasks, exams and study."
        checked={enabled}
        onChange={setEnabled}
      />
      <TextField
        label="Max per day"
        value={maxPerDay}
        onChangeText={setMaxPerDay}
        placeholder="3"
        keyboardType="number-pad"
        autoCapitalize="none"
      />
      <Text style={styles.subhead}>Nudge types</Text>
      <View style={styles.typesGrid}>
        {nudgeTypeOptions.map(option => {
          const on = types[option.key];
          return (
            <Pressable
              key={option.key}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`Toggle ${option.label} nudges`}
              onPress={() =>
                setTypes(prev => ({ ...prev, [option.key]: !prev[option.key] }))
              }
              style={[styles.typeChip, on ? styles.typeChipOn : null]}
            >
              <Text
                style={[
                  styles.typeChipLabel,
                  on ? styles.typeChipLabelOn : null,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {formError ? <ErrorBanner message={formError} /> : null}
      <Button
        label="Save nudges"
        onPress={() => void save()}
        loading={isLoading}
      />
    </Card>
  );
}

function CloudAiSection({ user }: { user: User }) {
  const [on, setOn] = useState(user.cloudAiForDocs);
  const [formError, setFormError] = useState<string | null>(null);
  const [updateMe, { isLoading }] = useUpdateMeMutation();
  const [updateConsent] = useUpdateConsentMutation();

  const save = async () => {
    setFormError(null);
    try {
      await updateMe({ cloudAiForDocs: on }).unwrap();
      await updateConsent({
        kind: "CLOUD_AI",
        granted: on,
        source: "settings-cloud-ai",
      }).unwrap();
    } catch (e) {
      setFormError(apiErrorMessage(e, "Could not save this preference."));
    }
  };

  return (
    <Card title="CLOUD AI">
      <ToggleRow
        label="Cloud AI for documents"
        hint="Lets Robo send the text of your uploads to a third-party AI to answer questions about them."
        checked={on}
        onChange={setOn}
      />
      {formError ? <ErrorBanner message={formError} /> : null}
      <Button
        label="Save"
        onPress={() => void save()}
        loading={isLoading}
        disabled={on === user.cloudAiForDocs}
      />
    </Card>
  );
}


const consentOptions: {
  kind: ConsentKind;
  label: string;
  hint: string;
}[] = [
  {
    kind: "MICROPHONE",
    label: "Microphone",
    hint: "Lets you talk to Robo. Audio is only captured while you are speaking with it.",
  },
  {
    kind: "CONTACTS",
    label: "Contacts",
    hint: "Lets Robo import names, phone numbers and emails when you ask it to.",
  },
  {
    kind: "DOCUMENTS",
    label: "Documents",
    hint: "Stores and indexes the files you upload so Robo can search them.",
  },
  {
    kind: "CLOUD_AI",
    label: "Cloud AI",
    hint: "Allows document excerpts to be sent to a third-party AI for answers.",
  },
];

function ConsentSection() {
  const { data, isLoading } = useConsentsQuery();
  const [updateConsent, { isLoading: saving }] = useUpdateConsentMutation();
  const [formError, setFormError] = useState<string | null>(null);

  const granted = new Map(
    (data ?? []).map(record => [record.kind, record.granted])
  );

  const setConsent = async (kind: ConsentKind, value: boolean) => {
    setFormError(null);
    try {
      await updateConsent({ kind, granted: value, source: "settings" }).unwrap();
    } catch (e) {
      setFormError(apiErrorMessage(e, "Could not save this consent."));
    }
  };

  return (
    <Card title="PRIVACY & CONSENT">
      <Text style={styles.hint}>
        You can withdraw consent at any time. Robo records the change so the
        permission history is auditable.
      </Text>
      {isLoading ? <Text style={styles.hint}>Loading consents…</Text> : null}
      {consentOptions.map(option => (
        <ToggleRow
          key={option.kind}
          label={option.label}
          hint={option.hint}
          checked={granted.get(option.kind) ?? false}
          onChange={value => {
            if (!saving) void setConsent(option.kind, value);
          }}
        />
      ))}
      {formError ? <ErrorBanner message={formError} /> : null}
    </Card>
  );
}

function DataSection() {
  const router = useRouter();
  const [exportData, { isLoading }] = useExportDataMutation();
  const [formError, setFormError] = useState<string | null>(null);

  const runExport = async () => {
    setFormError(null);

    let payload: unknown;
    try {
      payload = await exportData().unwrap();
    } catch (e) {
      setFormError(apiErrorMessage(e, "Could not build your export."));
      return;
    }

    try {
      await Share.share({ message: JSON.stringify(payload, null, 2) });
    } catch {
      setFormError(
        "Your export was ready but too large to share. Try again later."
      );
    }
  };

  return (
    <Card title="DATA">
      <Text style={styles.hint}>
        Download a JSON snapshot of everything Robo has stored for you.
      </Text>
      {formError ? <ErrorBanner message={formError} /> : null}
      <Button
        label="Export my data"
        variant="ghost"
        onPress={() => void runExport()}
        loading={isLoading}
      />
      <LinkRow label="Memories" onPress={() => router.push("/memories")} />
    </Card>
  );
}

function DangerSection({ email }: { email: string }) {
  const dispatch = useAppDispatch();
  const [deleteAccount, { isLoading }] = useDeleteAccountMutation();
  const [formError, setFormError] = useState<string | null>(null);

  const destroy = async () => {
    setFormError(null);
    try {
      await deleteAccount().unwrap();
      await dispatch(signOut());
    } catch (e) {
      setFormError(
        apiErrorMessage(e, "Could not delete your account. Try again.")
      );
    }
  };

  const askTwice = () => {
    Alert.alert(
      "Really delete?",
      "Last chance. This removes your account for good.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete forever",
          style: "destructive",
          onPress: () => void destroy(),
        },
      ]
    );
  };

  const askOnce = () => {
    Alert.alert(
      "Delete account?",
      `This will permanently remove ${email}, every device, document, chat, and log.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Continue", style: "destructive", onPress: askTwice },
      ]
    );
  };

  return (
    <Card title="DANGER ZONE">
      <Text style={styles.hint}>
        Signing out only closes this session. Deleting the account is
        irreversible.
      </Text>
      {formError ? <ErrorBanner message={formError} /> : null}
      <Button
        label="Sign out"
        variant="ghost"
        onPress={() => void dispatch(signOut())}
      />
      <Button
        label="Delete my account"
        variant="ghost"
        style={styles.dangerButton}
        onPress={askOnce}
        loading={isLoading}
        disabled={isLoading}
      />
    </Card>
  );
}

function LinkRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${label}`}
      onPress={onPress}
      style={({ pressed }) => [styles.linkRow, pressed ? styles.pressed : null]}
    >
      <Text style={styles.linkLabel}>{label}</Text>
      <Text style={styles.linkChevron}>›</Text>
    </Pressable>
  );
}

function LinksSection() {
  const router = useRouter();
  return (
    <Card title="ACCOUNT">
      <LinkRow label="Devices" onPress={() => router.push("/devices")} />
      <LinkRow label="Activity" onPress={() => router.push("/activity")} />
    </Card>
  );
}

export default function SettingsScreen() {
  const { data, isLoading, isError, error } = useMeQuery();
  const authUser = useAppSelector(state => state.auth.user);
  const user = data ?? authUser;

  if (!user) {
    return (
      <Screen>
        <ScreenHeader kicker="SETTINGS" />
        {isError ? (
          <ErrorBanner
            message={apiErrorMessage(error, "Could not load your settings.")}
          />
        ) : isLoading ? (
          <Text style={styles.muted}>Loading settings…</Text>
        ) : (
          <EmptyState
            title="Not signed in."
            body="Sign in to manage your account preferences."
          />
        )}
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader kicker="SETTINGS" />
      <IdentitySection key={user.id} user={user} />
      <QuietHoursSection user={user} />
      <WakePhraseSection user={user} />
      <NudgesSection user={user} />
      <CloudAiSection user={user} />
      <ConsentSection />
      <DataSection />
      <DangerSection email={user.email} />
      <LinksSection />
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: {
    color: colors.textMuted,
    fontSize: 14,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  subhead: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginTop: spacing.xs,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  metaLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  metaValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },
  inlineFields: {
    flexDirection: "row",
    gap: spacing.md,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  toggleCopy: {
    flex: 1,
    gap: 2,
  },
  toggleLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  toggleHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  switchTrack: {
    width: 44,
    height: 26,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  switchOn: {
    borderColor: colors.accent,
    backgroundColor: "rgba(124, 227, 177, 0.24)",
  },
  switchKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.textMuted,
  },
  switchKnobOn: {
    backgroundColor: colors.accent,
    alignSelf: "flex-end",
  },
  typesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  typeChip: {
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  typeChipOn: {
    borderColor: colors.accent,
    backgroundColor: "rgba(124, 227, 177, 0.14)",
  },
  typeChipLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  typeChipLabelOn: {
    color: colors.accent,
    fontWeight: "800",
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  linkLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  linkChevron: {
    color: colors.textMuted,
    fontSize: 20,
    lineHeight: 22,
  },
  dangerButton: {
    borderColor: colors.danger,
  },
  pressed: {
    opacity: 0.82,
  },
});
