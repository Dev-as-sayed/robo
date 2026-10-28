import { Redirect, Tabs, router } from "expo-router";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { StyleSheet, Text } from "react-native";
import { useRegisterPushTokenMutation } from "@/api/notifications-api";
import { useRemindersQuery } from "@/api/reminders-api";
import {
  registerForPushNotifications,
  syncLocalReminderNotifications,
} from "@/notifications";
import { activityApi, pendingActionsApi } from "@/api/registry";
import { connectAppRealtime } from "@/realtime";
import { useTranslation } from "@/i18n";
import { useAppDispatch, useAppSelector } from "@/store";
import { colors } from "@/theme";

function Letter({ letter, focused }: { letter: string; focused: boolean }) {
  return (
    <Text style={[styles.letter, focused ? styles.letterOn : null]}>
      {letter}
    </Text>
  );
}

export default function AppLayout() {
  const user = useAppSelector(state => state.auth.user);
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [registerPushToken] = useRegisterPushTokenMutation();
  const { data: reminders } = useRemindersQuery(undefined, {
    skip: !user,
  });

  useEffect(() => {
    if (!user) {
      return;
    }

    void registerForPushNotifications(input => registerPushToken(input).unwrap()).catch(
      () => false
    );
  }, [user, registerPushToken]);

  useEffect(() => {
    if (!reminders) return;
    void syncLocalReminderNotifications(reminders).catch(() => 0);
  }, [reminders]);

  useEffect(() => {
    if (!user) return;

    return connectAppRealtime(event => {
      dispatch(pendingActionsApi.util.invalidateTags(["PendingAction"]));
      if (event.type === "action.execute") {
        dispatch(activityApi.util.invalidateTags(["Activity"]));
      }
    });
  }, [dispatch, user]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as {
        reminderId?: unknown;
        kind?: unknown;
      };
      if (data.kind === "class_note") {
        router.push("/class-notes");
        return;
      }
      if (data.kind === "pending_action") {
        router.push("/approvals");
        return;
      }
      const reminderId = typeof data.reminderId === "string" ? data.reminderId : "";
      router.push(reminderId.startsWith("todo-deadline:") ? "/tasks" : "/reminders");
    });

    return () => subscription.remove();
  }, []);

  if (!user) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("nav.today"),
          tabBarIcon: ({ focused }) => <Letter letter="T" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: t("nav.chat"),
          tabBarIcon: ({ focused }) => <Letter letter="C" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: t("nav.tasks"),
          tabBarIcon: ({ focused }) => <Letter letter="K" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: t("nav.insights"),
          tabBarIcon: ({ focused }) => <Letter letter="I" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("nav.settings"),
          tabBarIcon: ({ focused }) => <Letter letter="S" focused={focused} />,
        }}
      />

      <Tabs.Screen name="devices" options={{ href: null }} />
      <Tabs.Screen name="reminders" options={{ href: null }} />
      <Tabs.Screen name="schedule" options={{ href: null }} />
      <Tabs.Screen name="exams" options={{ href: null }} />
      <Tabs.Screen name="documents" options={{ href: null }} />
      <Tabs.Screen name="contacts" options={{ href: null }} />
      <Tabs.Screen name="activity" options={{ href: null }} />
      <Tabs.Screen name="study" options={{ href: null }} />
      <Tabs.Screen name="approvals" options={{ href: null }} />
      <Tabs.Screen name="memories" options={{ href: null }} />
      <Tabs.Screen name="class-notes" options={{ href: null }} />
      <Tabs.Screen name="quizzes" options={{ href: null }} />
      <Tabs.Screen name="vision" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "700",
  },
  letter: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: "800",
  },
  letterOn: {
    color: colors.accent,
  },
});
