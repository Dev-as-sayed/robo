import { Redirect, Stack } from "expo-router";
import { useAppSelector } from "@/store";

export default function AppLayout() {
  const user = useAppSelector(state => state.auth.user);

  if (!user) {
    return <Redirect href="/sign-in" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
