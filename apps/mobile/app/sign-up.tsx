import { zodResolver } from "@hookform/resolvers/zod";
import { Redirect, useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRegisterMutation } from "@/api/auth-api";
import { apiErrorMessage } from "@/api/errors";
import { setTokens } from "@/auth/tokens";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { setUser } from "@/features/auth/auth-slice";
import { type RegisterInput, registerSchema } from "@/schemas";
import { useAppDispatch, useAppSelector } from "@/store";
import { colors, spacing } from "@/theme";

export default function SignUpScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector(state => state.auth.user);
  const [register, { isLoading, error }] = useRegisterMutation();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  if (user) {
    return <Redirect href="/(app)" />;
  }

  const onSubmit = async (values: RegisterInput) => {
    try {
      const result = await register(values).unwrap();
      await setTokens(result.tokens);
      dispatch(setUser(result.user));
      router.replace("/onboarding");
    } catch {
      // The mutation error is rendered below.
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.kicker}>GET STARTED</Text>
      </View>

      <View style={styles.intro}>
        <Text style={styles.title}>Meet your{"\n"}study sidekick.</Text>
        <Text style={styles.subtitle}>
          One account keeps your classes and your conversations together.
        </Text>
      </View>

      {error ? (
        <ErrorBanner
          message={apiErrorMessage(
            error,
            "Could not create your account. Try again."
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
              label="Name"
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder="What should Robo call you?"
              value={value}
              error={errors.name?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              label="Email"
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder="you@school.edu"
              value={value}
              error={errors.email?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField
              autoCapitalize="none"
              autoComplete="new-password"
              label="Password"
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder="At least 8 characters"
              secureTextEntry
              value={value}
              error={errors.password?.message}
            />
          )}
        />
      </View>

      <View style={styles.actions}>
        <Button
          label="Create account"
          loading={isLoading}
          onPress={handleSubmit(onSubmit)}
        />
        <Pressable
          onPress={() => router.replace("/sign-in")}
          style={styles.switchLink}
        >
          <Text style={styles.switchText}>
            Already have an account?{" "}
            <Text style={styles.switchAccent}>Sign in</Text>
          </Text>
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
  back: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: "600",
  },
  kicker: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
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
  actions: {
    gap: spacing.lg,
    marginTop: "auto",
  },
  switchLink: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  switchText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  switchAccent: {
    color: colors.accent,
    fontWeight: "700",
  },
});
