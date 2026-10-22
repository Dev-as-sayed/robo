import { Redirect, Tabs } from "expo-router";
import { StyleSheet, Text } from "react-native";
import { useAppSelector } from "@/store";
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
          title: "Today",
          tabBarIcon: ({ focused }) => <Letter letter="T" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
          tabBarIcon: ({ focused }) => <Letter letter="C" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: "Tasks",
          tabBarIcon: ({ focused }) => <Letter letter="K" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: "Insights",
          tabBarIcon: ({ focused }) => <Letter letter="I" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
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
