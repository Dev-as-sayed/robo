import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import {
  useConfirmPendingActionMutation,
  usePendingActionsQuery,
  useRejectPendingActionMutation,
} from "@/api/pending-actions-api";
import type { PendingAction, PendingActionKind } from "@/types";
import { colors, radii, spacing } from "@/theme";

const actionLabels: Record<PendingActionKind, string> = {
  CALL: "Call",
  MESSAGE: "Text",
  EMAIL: "Email",
  WHATSAPP: "WhatsApp",
};

function describeError(error: unknown): string {
  return typeof error === "string"
    ? error
    : "The action could not be updated. Prepare it again.";
}

function expiryLabel(action: PendingAction): string {
  const seconds = Math.max(
    0,
    Math.ceil((new Date(action.expiresAt).getTime() - Date.now()) / 1000)
  );
  const minutes = Math.floor(seconds / 60);
  const rest = String(seconds % 60).padStart(2, "0");

  return `Expires in ${minutes}:${rest}`;
}

export default function ApprovalsScreen() {
  const router = useRouter();
  const { actionId } = useLocalSearchParams<{ actionId?: string }>();
  const { data: actions, isLoading, isError, error, refetch } = usePendingActionsQuery();
  const [confirmAction] = useConfirmPendingActionMutation();
  const [rejectAction] = useRejectPendingActionMutation();

  const [confirmedUri, setConfirmedUri] = useState<{ label: string; uri: string } | null>(
    null
  );
  const [failed, setFailed] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const orderedActions = [...(actions ?? [])].sort((left, right) => {
    if (left.id === actionId) return -1;
    if (right.id === actionId) return 1;
    return 0;
  });

  const open = async (label: string, uri: string): Promise<void> => {
    const supported = await Linking.canOpenURL(uri);
    if (!supported) {
      throw new Error(`This phone cannot open ${label.toLowerCase()}.`);
    }
    await Linking.openURL(uri);
  };

  const confirm = async (action: PendingAction): Promise<void> => {
    setFailed(null);
    setBusyId(action.id);
    try {
      const confirmed = await confirmAction(action.id).unwrap();
      setConfirmedUri({ label: action.recipientName, uri: confirmed.uri });
      await refetch();
      await open(action.recipientName, confirmed.uri);
    } catch (caught) {
      setFailed(describeError(caught));
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (action: PendingAction): Promise<void> => {
    setFailed(null);
    setBusyId(action.id);
    try {
      await rejectAction(action.id).unwrap();
      await refetch();
    } catch (caught) {
      setFailed(describeError(caught));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Screen>
      <ScreenHeader
        kicker="APPROVALS"
        onBack={router.canGoBack() ? () => router.back() : undefined}
      />

      {isError ? (
        <ErrorBanner
          message={typeof error === "string" ? error : "Approvals could not be loaded."}
        />
      ) : null}
      {failed ? <ErrorBanner message={failed} /> : null}

      {confirmedUri ? (
        <Card title="CONFIRMED" tone="accent">
          <Text style={styles.muted}>
            Robo is ready to open the {confirmedUri.label} action on this phone.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void open(confirmedUri.label, confirmedUri.uri)}
            style={({ pressed }) => [styles.open, pressed ? styles.pressed : null]}
          >
            <Text style={styles.openLabel}>Open again</Text>
          </Pressable>
        </Card>
      ) : null}

      {isLoading ? (
        <Text style={styles.muted}>Loading approvals…</Text>
      ) : !actions || actions.length === 0 ? (
        <EmptyState
          title="Nothing waiting for approval."
          body="Ask Robo to call or message someone. It will prepare the action here and wait for your tap before opening the dialer or composer."
        />
      ) : (
        orderedActions.map(action => (
          <Card key={action.id} title={actionLabels[action.kind].toUpperCase()}>
            <Text style={styles.recipient}>{action.recipientName}</Text>
            <Text style={styles.muted}>
              {action.recipientPhone ?? action.recipientEmail ?? "No address"}
            </Text>
            {action.body ? <Text style={styles.body}>{action.body}</Text> : null}
            <Text style={styles.expiry}>{expiryLabel(action)}</Text>

            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                disabled={busyId === action.id}
                onPress={() => void confirm(action)}
                style={({ pressed }) => [
                  styles.confirm,
                  busyId === action.id ? styles.disabled : null,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Text style={styles.confirmLabel}>
                  {busyId === action.id ? "Working…" : "Confirm"}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={busyId === action.id}
                onPress={() => void reject(action)}
                style={({ pressed }) => [
                  styles.reject,
                  busyId === action.id ? styles.disabled : null,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Text style={styles.rejectLabel}>Reject</Text>
              </Pressable>
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  recipient: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  muted: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  body: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    borderStartWidth: 2,
    borderStartColor: colors.accent,
    paddingStart: spacing.md,
  },
  expiry: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: "700",
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  confirm: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    paddingVertical: spacing.md,
  },
  confirmLabel: {
    color: colors.background,
    fontSize: 14,
    fontWeight: "800",
  },
  reject: {
    flex: 1,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingVertical: spacing.md,
  },
  rejectLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.8,
  },
  open: {
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radii.sm,
    paddingVertical: spacing.md,
  },
  openLabel: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "700",
  },
});
