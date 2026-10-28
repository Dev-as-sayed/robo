import { zodResolver } from "@hookform/resolvers/zod";
import { Redirect, useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLoginMutation } from "@/api/auth-api";
import { apiErrorMessage } from "@/api/errors";
import { setTokens } from "@/auth/tokens";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { setUser } from "@/features/auth/auth-slice";
import { type LoginInput, loginSchema } from "@/schemas";
import { useAppDispatch, useAppSelector } from "@/store";
import { colors, spacing } from "@/theme";

export default function SignInScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector(state => state.auth.user);
  const [login, { isLoading, error }] = useLoginMutation();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  if (user) {
    return <Redirect href="/(app)" />;
  }

  const onSubmit = async (values: LoginInput) => {
    try {
      const result = await login(values).unwrap();
      await setTokens(result.tokens);
      dispatch(setUser(result.user));
      router.replace("/(app)");
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
        <Text style={styles.kicker}>WELCOME BACK</Text>
      </View>

      <View style={styles.intro}>
        <Text style={styles.title}>Pick up where{"\n"}you left off.</Text>
        <Text style={styles.subtitle}>
          Sign in to sync your classes, tasks, and Robo preferences.
        </Text>
      </View>

      {error ? (
        <ErrorBanner
          message={apiErrorMessage(error, "Could not sign in. Try again.")}
        />
      ) : null}

      <View style={styles.form}>
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              label="Email"
              testID="email"
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
              autoComplete="current-password"
              label="Password"
              testID="password"
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder="Your password"
              secureTextEntry
              value={value}
              error={errors.password?.message}
            />
          )}
        />
      </View>

      <View style={styles.actions}>
        <Button
          label="Sign in"
          loading={isLoading}
          onPress={handleSubmit(onSubmit)}
        />
        <Pressable
          onPress={() => router.replace("/sign-up")}
          style={styles.switchLink}
        >
          <Text style={styles.switchText}>
            New here? <Text style={styles.switchAccent}>Create an account</Text>
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
