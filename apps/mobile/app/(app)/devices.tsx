import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiErrorMessage } from "@/api/errors";
import {
  useDevicesQuery,
  useFactoryResetDeviceMutation,
  usePairingCodeMutation,
  useRevokeDeviceMutation,
  useUpdateDeviceMutation,
} from "@/api/devices-api";
import { ErrorBanner } from "@/components/ErrorBanner";
import { clock, relativeTime } from "@/lib/time";
import type { Device, DeviceStatus, PairingCode } from "@/types";
import { colors, radii, spacing } from "@/theme";

const statusLabels: Record<DeviceStatus, string> = {
  ONLINE: "Online",
  OFFLINE: "Offline",
  PENDING: "Waiting for setup",
  REVOKED: "Revoked",
};

function statusColor(status: DeviceStatus): string {
  if (status === "ONLINE") return colors.accent;
  if (status === "PENDING") return colors.warning;
  if (status === "REVOKED") return colors.danger;
  return colors.textMuted;
}

function PairingPanel() {
  const [requestCode, { isLoading, error }] = usePairingCodeMutation();
  const [pairing, setPairing] = useState<PairingCode | null>(null);
  const [secondsLeft, setSecondsLeft] = useState("0:00");

  useEffect(() => {
    if (!pairing) return;

    const tick = () =>
      setSecondsLeft(clock(new Date(pairing.expiresAt).getTime() - Date.now()));

    tick();
    const timer = setInterval(tick, 1000);

    return () => clearInterval(timer);
  }, [pairing]);

  const generate = async () => {
    try {
      setPairing(await requestCode().unwrap());
    } catch {
      // The mutation error is rendered below.
    }
  };

  if (!pairing) {
    return (
      <View style={styles.pairPanel}>
        <Text style={styles.pairTitle}>Add the speaker</Text>
        <Text style={styles.pairBody}>
          Put the device in setup mode, then show it a fresh pairing code. The
          code expires in ten minutes.
        </Text>
        {error ? (
          <ErrorBanner
            message={apiErrorMessage(error, "Could not create a pairing code.")}
          />
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => void generate()}
          style={({ pressed }) => [
            styles.pairButton,
            pressed ? styles.pressed : null,
          ]}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.accentInk} size="small" />
          ) : (
            <Text style={styles.pairButtonLabel}>Create pairing code</Text>
          )}
        </Pressable>
      </View>
    );
  }

  const expired = new Date(pairing.expiresAt).getTime() <= Date.now();

  return (
    <View style={styles.pairPanel}>
      <Text style={styles.pairTitle}>Show this code on the speaker</Text>
      <Text style={styles.code}>{pairing.code}</Text>
      <Text style={styles.pairBody}>
        {expired
          ? "This code expired. Create a new one."
          : `Expires in ${secondsLeft}. Type it on the device or scan the payload below.`}
      </Text>
      <Text style={styles.payload}>{pairing.qrPayload}</Text>
      <View style={styles.pairActions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setPairing(null)}
          style={({ pressed }) => [
            styles.ghostButton,
            pressed ? styles.pressed : null,
          ]}
        >
          <Text style={styles.ghostButtonLabel}>Done</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => void generate()}
          style={({ pressed }) => [
            styles.pairButton,
            pressed ? styles.pressed : null,
          ]}
        >
          <Text style={styles.pairButtonLabel}>New code</Text>
        </Pressable>
      </View>
    </View>
  );
}

function DeviceCard({ device }: { device: Device }) {
  const [updateDevice, { isLoading: isSaving }] = useUpdateDeviceMutation();
  const [revokeDevice] = useRevokeDeviceMutation();
  const [factoryReset] = useFactoryResetDeviceMutation();
  const [isRenaming, setIsRenaming] = useState(false);
  const [name, setName] = useState(device.name ?? "");

  const saveName = async () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;

    try {
      await updateDevice({ id: device.id, name: trimmed }).unwrap();
      setIsRenaming(false);
    } catch {
      // Keep the editor open; the list refresh shows the failure.
    }
  };

  const confirmRevoke = () => {
    Alert.alert(
      "Remove this device?",
      "It will stop working with your account.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => void revokeDevice(device.id),
        },
      ]
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.statusDot}>
          <View
            style={[
              styles.statusDotInner,
              { backgroundColor: statusColor(device.status) },
            ]}
          />
          <Text
            style={[styles.statusLabel, { color: statusColor(device.status) }]}
          >
            {statusLabels[device.status]}
          </Text>
        </View>
        <Text style={styles.lastSeen}>
          {device.lastSeenAt
            ? `Seen ${relativeTime(device.lastSeenAt)}`
            : "Never seen"}
        </Text>
      </View>

      {isRenaming ? (
        <View style={styles.renameRow}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Device name"
            placeholderTextColor={colors.textMuted}
            maxLength={100}
            style={styles.renameInput}
            onSubmitEditing={() => void saveName()}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => void saveName()}
            disabled={isSaving}
            style={({ pressed }) => [
              styles.ghostButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.ghostButtonLabel}>Save</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setName(device.name ?? "");
              setIsRenaming(false);
            }}
            style={({ pressed }) => [
              styles.ghostButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.ghostButtonLabel}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={styles.deviceName}>{device.name ?? device.deviceId}</Text>
      )}

      <Text style={styles.deviceMeta}>
        {device.deviceId}
        {device.firmwareVersion ? ` · fw ${device.firmwareVersion}` : ""}
        {device.locale ? ` · ${device.locale}` : ""}
      </Text>

      {device.status !== "REVOKED" ? (
        <View style={styles.cardActions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setIsRenaming(true)}
            style={({ pressed }) => [
              styles.textButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.textButtonLabel}>Rename</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => void factoryReset(device.id)}
            style={({ pressed }) => [
              styles.textButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.textButtonLabel}>Factory reset</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={confirmRevoke}
            style={({ pressed }) => [
              styles.textButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={[styles.textButtonLabel, styles.danger]}>Remove</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export default function DevicesScreen() {
  const router = useRouter();
  const {
    data: devices,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useDevicesQuery();

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Text style={styles.headerMuted}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>DEVICES</Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={devices ?? []}
        keyExtractor={device => device.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={() => void refetch()}
            tintColor={colors.accent}
          />
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {isError ? (
              <ErrorBanner
                message={apiErrorMessage(
                  error,
                  "Could not load your devices. Pull down to retry."
                )}
              />
            ) : null}
            <PairingPanel />
          </View>
        }
        ListEmptyComponent={
          isLoading ? null : (
            <Text style={styles.empty}>
              No devices yet. The pairing code above starts the setup.
            </Text>
          )
        }
        renderItem={({ item }) => <DeviceCard device={item} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
  },
  headerMuted: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: "600",
  },
  headerSpacer: {
    width: 44,
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  listHeader: {
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  pairPanel: {
    gap: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(124, 227, 177, 0.3)",
    backgroundColor: "rgba(124, 227, 177, 0.08)",
    padding: spacing.lg,
  },
  pairTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  pairBody: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  code: {
    color: colors.accent,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 3,
  },
  payload: {
    color: colors.textMuted,
    fontSize: 12,
  },
  pairActions: {
    flexDirection: "row",
    gap: spacing.md,
  },
  pairButton: {
    minHeight: 46,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: radii.sm,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
  },
  pairButtonLabel: {
    color: colors.accentInk,
    fontSize: 15,
    fontWeight: "800",
  },
  ghostButton: {
    minHeight: 46,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
  },
  ghostButtonLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.82,
  },
  card: {
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  statusDot: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  statusDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  lastSeen: {
    color: colors.textMuted,
    fontSize: 12,
  },
  deviceName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
  },
  deviceMeta: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  renameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  renameInput: {
    flex: 1,
    minHeight: 46,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: spacing.md,
  },
  cardActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.lg,
    paddingTop: spacing.sm,
  },
  textButton: {
    paddingVertical: spacing.xs,
  },
  textButtonLabel: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "700",
  },
  danger: {
    color: colors.danger,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
});
