import { zodResolver } from "@hookform/resolvers/zod";
import { Redirect, useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useUpdateMeMutation } from "@/api/auth-api";
import { apiErrorMessage } from "@/api/errors";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { setUser } from "@/features/auth/auth-slice";
import { type OnboardingInput, onboardingSchema } from "@/schemas";
import { useAppDispatch, useAppSelector } from "@/store";
import { colors, radii, spacing } from "@/theme";

const languages = [
  { code: "en" as const, label: "English", note: "Ready" },
  { code: "hi" as const, label: "Hindi", note: "Preview" },
];

function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export default function OnboardingScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector(state => state.auth.user);
  const [updateMe, { isLoading, error }] = useUpdateMeMutation();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<OnboardingInput>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      name: user?.name ?? "",
      locale: user?.locale?.startsWith("hi") ? "hi" : "en",
      timezone: user?.timezone || deviceTimezone(),
    },
  });

  if (!user) {
    return <Redirect href="/sign-in" />;
  }

  const onSubmit = async (values: OnboardingInput) => {
    try {
      const updated = await updateMe(values).unwrap();
      dispatch(setUser(updated));
      router.replace("/(app)");
    } catch {
      // The mutation error is rendered below.
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.kicker}>SETUP</Text>
        <Text style={styles.step}>01 / 01</Text>
      </View>

      <View style={styles.intro}>
        <Text style={styles.title}>Make Robo{"\n"}yours.</Text>
        <Text style={styles.subtitle}>
          Pick how Robo should speak to you. You can change this later.
        </Text>
      </View>

      {error ? (
        <ErrorBanner
          message={apiErrorMessage(
            error,
            "Could not save your preferences. Try again."
          )}
        />
      ) : null}

      <View style={styles.form}>
        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField
              autoComplete="name"
              label="Your name"
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder="What should Robo call you?"
              value={value}
              error={errors.name?.message}
            />
          )}
        />

        <View style={styles.field}>
          <Text style={styles.label}>Language</Text>
          <Controller
            control={control}
            name="locale"
            render={({ field: { onChange, value } }) => (
              <View style={styles.languages}>
                {languages.map(language => {
                  const active = value === language.code;
                  return (
                    <Pressable
                      key={language.code}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                      onPress={() => onChange(language.code)}
                      style={[
                        styles.language,
                        active ? styles.languageActive : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.languageLabel,
                          active ? styles.languageLabelActive : null,
                        ]}
                      >
                        {language.label}
                      </Text>
                      <Text
                        style={[
                          styles.languageNote,
                          active ? styles.languageNoteActive : null,
                        ]}
                      >
                        {language.note}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          />
        </View>

        <Controller
          control={control}
          name="timezone"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField
              autoCapitalize="none"
              autoCorrect={false}
              label="Time zone"
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder="Asia/Kolkata"
              value={value}
              error={errors.timezone?.message}
            />
          )}
        />
        <Text style={styles.hint}>
          Detected from your device. Use an IANA name like Asia/Kolkata.
        </Text>
      </View>

      <View style={styles.actions}>
        <Button
          label="Start using Robo"
          loading={isLoading}
          onPress={handleSubmit(onSubmit)}
        />
        <Pressable onPress={() => router.replace("/(app)")} style={styles.skip}>
          <Text style={styles.skipText}>Skip for now</Text>
        </Pressable>
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
  kicker: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
  },
  step: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
  },
  intro: {
    gap: spacing.md,
    paddingTop: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: -0.8,
    lineHeight: 42,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 23,
  },
  form: {
    gap: spacing.lg,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  languages: {
    flexDirection: "row",
    gap: spacing.md,
  },
  language: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  languageActive: {
    borderColor: colors.accent,
    backgroundColor: "rgba(124, 227, 177, 0.12)",
  },
  languageLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  languageLabelActive: {
    color: colors.accent,
  },
  languageNote: {
    color: colors.textMuted,
    fontSize: 12,
  },
  languageNoteActive: {
    color: colors.accent,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  actions: {
    gap: spacing.md,
    marginTop: "auto",
  },
  skip: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  skipText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
});
