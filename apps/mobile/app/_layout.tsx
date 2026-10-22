import "react-native-gesture-handler";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Provider } from "react-redux";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { restoreSession } from "@/features/auth/session";
import { store, useAppDispatch, useAppSelector } from "@/store";
import { colors } from "@/theme";

function AppShell() {
  const dispatch = useAppDispatch();
  const bootstrapped = useAppSelector(state => state.auth.bootstrapped);

  useEffect(() => {
    void dispatch(restoreSession());
  }, [dispatch]);

  if (!bootstrapped) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <AppShell />
      </SafeAreaProvider>
    </Provider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
});
