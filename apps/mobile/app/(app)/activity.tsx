import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { OptionList, type Option } from "@/components/OptionList";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { StatusPill, type PillTone } from "@/components/StatusPill";
import { useActionLogsQuery } from "@/api/activity-api";
import { relativeTime, toDate } from "@/lib/time";
import type { ActionLogEntry, ActionLogStatus } from "@/types";
import { colors, radii, spacing } from "@/theme";

type StatusFilter = "all" | "SUCCESS" | "ERROR";
type LimitChoice = "25" | "50" | "100";

const statusTones: Record<ActionLogStatus, PillTone> = {
  SUCCESS: "success",
  ERROR: "danger",
  CONFIRMATION_REQUIRED: "warning",
};

const statusLabels: Record<ActionLogStatus, string> = {
  SUCCESS: "Success",
  ERROR: "Error",
  CONFIRMATION_REQUIRED: "Needs confirmation",
};

const filterOptions: Option<StatusFilter>[] = [
  { value: "all", label: "All" },
  { value: "SUCCESS", label: "Success" },
  { value: "ERROR", label: "Errors" },
];

const limitOptions: Option<LimitChoice>[] = [
  { value: "25", label: "Latest 25" },
  { value: "50", label: "Latest 50" },
  { value: "100", label: "Latest 100" },
];

/**
 * Dumps are truncated client-side so a huge tool payload cannot flood the screen.
 */
const MAX_DUMP_CHARS = 900;

/**
 * `input` and `output` are `unknown` on the wire, so nothing may be rendered raw.
 * Strings pass through, everything else goes through a guarded JSON stringify and
 * finally through String(), which can still throw on exotic objects.
 */
function serialize(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === undefined) return "nothing recorded";
  if (value === null) return "null";

  try {
    const json = JSON.stringify(value, null, 2);
    if (typeof json === "string") return json;
  } catch {
    // Circular structures and BigInt fall through to the string coercion below.
  }

  try {
    return String(value);
  } catch {
    return "value could not be shown";
  }
}

function clip(
  text: string,
  expanded: boolean
): { body: string; hiddenChars: number } {
  if (expanded || text.length <= MAX_DUMP_CHARS) {
    return { body: text, hiddenChars: 0 };
  }

  return {
    body: `${text.slice(0, MAX_DUMP_CHARS)}\n...`,
    hiddenChars: text.length - MAX_DUMP_CHARS,
  };
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "no timing";
  if (ms < 1000) return `${Math.round(ms)} ms`;

  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 2 : 1)} s`;

  const minutes = Math.floor(seconds / 60);

  return `${minutes}m ${Math.round(seconds % 60)}s`;
}

function newestFirst(entries: ActionLogEntry[]): ActionLogEntry[] {
  return [...entries].sort(
    (a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime()
  );
}

function DetailBlock({
  label,
  value,
  expanded,
}: {
  label: string;
  value: unknown;
  expanded: boolean;
}) {
  const { body, hiddenChars } = clip(serialize(value), expanded);

  return (
    <View style={styles.block}>
      <Text style={styles.blockLabel}>
        {label}
        {hiddenChars > 0 ? ` · ${hiddenChars} more chars` : ""}
      </Text>
      <Text style={styles.blockBody}>{body}</Text>
    </View>
  );
}

function LogRow({ entry }: { entry: ActionLogEntry }) {
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(false);

  const hasError = Boolean(entry.error);
  const hiddenChars =
    clip(serialize(entry.input), false).hiddenChars +
    clip(serialize(entry.output), false).hiddenChars;

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${entry.toolName}, ${
          statusLabels[entry.status]
        }, ${formatDuration(entry.durationMs)}. ${open ? "Hide" : "Show"} details`}
        onPress={() => setOpen(value => !value)}
        style={({ pressed }) => [
          styles.rowHead,
          pressed ? styles.pressed : null,
        ]}
      >
        <View style={styles.rowCopy}>
          <Text style={styles.rowTitle} numberOfLines={2}>
            {entry.toolName}
          </Text>
          <Text style={styles.rowMeta}>
            {relativeTime(entry.createdAt)}
            {` · ${formatDuration(entry.durationMs)}`}
            {entry.conversationId ? " · from a conversation" : ""}
            {` · ${open ? "Less" : "More"}`}
          </Text>
        </View>
        <StatusPill
          label={statusLabels[entry.status]}
          tone={statusTones[entry.status]}
        />
      </Pressable>

      {hasError ? <Text style={styles.errorText}>{entry.error}</Text> : null}

      {open ? (
        <View style={styles.details}>
          <DetailBlock label="Input" value={entry.input} expanded={full} />
          <DetailBlock label="Output" value={entry.output} expanded={full} />
          {hiddenChars > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: full }}
              accessibilityLabel={
                full
                  ? "Show shortened payloads"
                  : `Show all ${hiddenChars} hidden characters`
              }
              onPress={() => setFull(value => !value)}
              style={({ pressed }) => [
                styles.more,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={styles.moreLabel}>
                {full ? "Show less" : `Show all ${hiddenChars} more characters`}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export default function ActivityScreen() {
  const router = useRouter();

  const [filter, setFilter] = useState<StatusFilter>("all");
  const [limit, setLimit] = useState<LimitChoice>("50");

  const { data, isLoading, isFetching, isError, error, refetch } =
    useActionLogsQuery({ limit: Number(limit) });

  const logs = newestFirst(data ?? []).filter(entry =>
    filter === "all" ? true : entry.status === filter
  );

  return (
    <Screen>
      <ScreenHeader kicker="ACTIVITY" onBack={() => router.back()} />

      <Card title="TOOL ACTIONS">
        <Text style={styles.caption}>
          This screen lists tool calls made by the voice and chat agent. Nothing
          else is logged here, so a fresh account — or a day spent only in the
          app — legitimately shows an empty timeline.
        </Text>
        <OptionList
          label="Status"
          value={filter}
          options={filterOptions}
          onChange={setFilter}
        />
        <OptionList
          label="How many"
          value={limit}
          options={limitOptions}
          onChange={setLimit}
        />
      </Card>

      {isError ? (
        <ErrorBanner
          message={
            typeof error === "string" ? error : "Activity could not be loaded."
          }
        />
      ) : null}

      {isLoading ? (
        <Text style={styles.muted}>Loading activity…</Text>
      ) : logs.length === 0 ? (
        <EmptyState
          title="No actions logged."
          body="Ask Robo something in chat — every tool it calls shows up here. The agent has to actually run a tool first."
        />
      ) : (
        <>
          {isFetching ? <Text style={styles.muted}>Refreshing…</Text> : null}
          {logs.map(entry => (
            <LogRow key={entry.id} entry={entry} />
          ))}
        </>
      )}

      <Pressable
        accessibilityRole="button"
        onPress={() => void refetch()}
        style={({ pressed }) => [
          styles.refresh,
          pressed ? styles.pressed : null,
        ]}
      >
        <Text style={styles.refreshLabel}>Refresh</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  caption: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  muted: {
    color: colors.textMuted,
    fontSize: 14,
  },
  row: {
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  rowHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  rowMeta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 19,
  },
  details: {
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  block: {
    gap: spacing.xs,
  },
  blockLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  blockBody: {
    color: colors.text,
    fontSize: 12,
    fontFamily: "monospace",
    lineHeight: 18,
  },
  more: {
    alignSelf: "flex-start",
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  moreLabel: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "700",
  },
  refresh: {
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  refreshLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.82,
  },
});
