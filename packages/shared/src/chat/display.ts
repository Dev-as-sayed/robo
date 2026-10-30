export type DisplaySection =
  | "tasks"
  | "reminders"
  | "schedule"
  | "exams"
  | "analytics"
  | "documents"
  | "contacts"
  | "actions"
  | "quizzes"
  | "plans"
  | "citations";

export interface DisplayItem {
  id?: string;
  title: string;
  subtitle?: string;
  meta?: string;
  status?: string;
  page?: number;
}

export interface DisplayActionLink {
  label: string;
  route: string;
}

export type DisplayBlock =
  | { type: "text"; text: string }
  | {
      type: "card";
      section: DisplaySection;
      title: string;
      items: DisplayItem[];
      action?: DisplayActionLink;
    };

export interface DisplayContent {
  version: 1;
  title: string | null;
  blocks: DisplayBlock[];
}

export interface DisplayAction {
  toolName: string;
  output: unknown;
}

const MAX_ACTIONS = 12;
const MAX_ITEMS = 10;

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function metric(value: unknown): string | undefined {
  return typeof value === "number" ? String(value) : text(value);
}

function item(value: unknown, fallback: string): DisplayItem | null {
  const row = record(value);
  if (!row) {
    return null;
  }

  const title =
    text(row.title) ?? text(row.text) ?? text(row.subject) ?? text(row.originalName) ?? text(row.name) ?? fallback;
  if (!title) {
    return null;
  }

  const subtitle =
    text(row.dueAt) ??
    text(row.at) ??
    text(row.nextAt) ??
    text(row.date) ??
    text(row.startAt) ??
    text(row.phone) ??
    text(row.email) ??
    text(row.description) ??
    undefined;

  const metaParts = [
    text(row.subject),
    text(row.room),
    text(row.teacher),
    text(row.priority),
    text(row.weight) ? `weight ${text(row.weight)}` : undefined,
    text(row.chunkCount) ? `${text(row.chunkCount)} chunks` : undefined,
  ].filter((part): part is string => Boolean(part));

  return {
    ...(text(row.id) ? { id: text(row.id) } : {}),
    title,
    ...(subtitle ? { subtitle } : {}),
    ...(metaParts.length > 0 ? { meta: metaParts.join(" · ") } : {}),
    ...(text(row.status) ? { status: text(row.status) } : {}),
  };
}

function itemsFrom(
  data: Record<string, unknown>,
  keys: string[],
  fallback: string
): DisplayItem[] {
  for (const key of keys) {
    const rows = array(data[key]);
    if (rows.length > 0) {
      return rows
        .map((row) => item(row, fallback))
        .filter((row): row is DisplayItem => row !== null)
        .slice(0, MAX_ITEMS);
    }

    const single = item(data[key], fallback);
    if (single) {
      return [single];
    }
  }

  const direct = item(data, fallback);
  return direct ? [direct] : [];
}

function card(
  section: DisplaySection,
  title: string,
  items: DisplayItem[],
  action?: DisplayActionLink
): DisplayBlock | null {
  return items.length > 0
    ? { type: "card", section, title, items, ...(action ? { action } : {}) }
    : null;
}

function analyticsBlocks(data: Record<string, unknown>): DisplayBlock[] {
  const labels: Array<[string, string]> = [
    ["sessions", "Study sessions"],
    ["studyMinutes", "Study minutes"],
    ["completedTodos", "Tasks completed"],
    ["completedQuizzes", "Quizzes completed"],
    ["activeReminders", "Active reminders"],
    ["upcomingExams", "Upcoming exams"],
    ["streakDays", "Day streak"],
    ["narrative", "Summary"],
  ];

  const items: DisplayItem[] = [];
  for (const [key, label] of labels) {
    const value = data[key];
    if (typeof value === "number" || typeof value === "string") {
      items.push({ title: label, meta: String(value) });
    }
  }

  const range = text(data.range);
  return [
    card("analytics", range ? `Study summary (${range})` : "Study summary", items),
  ].filter((block): block is DisplayBlock => block !== null);
}

function blocksForAction(action: DisplayAction): DisplayBlock[] {
  const data = record(action.output);
  if (!data) {
    return [];
  }

  switch (action.toolName) {
    case "list_todos":
    case "create_todo":
    case "update_todo":
    case "complete_todo": {
      const block = card("tasks", "Tasks", itemsFrom(data, ["todos", "todo"], "Task"));
      return block ? [block] : [];
    }
    case "list_reminders":
    case "create_reminder":
    case "snooze_reminder": {
      const block = card(
        "reminders",
        "Reminders",
        itemsFrom(data, ["reminders", "reminder"], "Reminder")
      );
      return block ? [block] : [];
    }
    case "get_schedule": {
      const block = card(
        "schedule",
        "Schedule",
        itemsFrom(data, ["schedule", "entries"], "Class")
      );
      return block ? [block] : [];
    }
    case "list_exams":
    case "create_exam":
    case "get_exam": {
      const block = card("exams", "Exams", itemsFrom(data, ["exams", "exam"], "Exam"));
      return block ? [block] : [];
    }
    case "list_documents": {
      const block = card(
        "documents",
        "Documents",
        itemsFrom(data, ["documents", "document"], "Document")
      );
      return block ? [block] : [];
    }
    case "find_contact": {
      const block = card(
        "contacts",
        "Contacts",
        itemsFrom(data, ["contacts", "contact"], "Contact")
      );
      return block ? [block] : [];
    }
    case "prepare_call":
    case "prepare_message":
    case "confirm_pending_action":
    case "reject_pending_action": {
      const row = record(data.pendingAction) ?? record(data.action);
      if (!row) {
        return [];
      }

      const kind = text(row.kind) ?? "action";
      const recipient = text(row.recipientName) ?? "contact";
      const label: Record<string, string> = {
        CALL: "Call",
        MESSAGE: "Text",
        EMAIL: "Email",
        WHATSAPP: "WhatsApp",
      };
      const pendingActionId = text(row.id);
      const block = card(
        "actions",
        "Needs confirmation",
        [
          {
            ...(pendingActionId ? { id: pendingActionId } : {}),
            title: `${label[kind] ?? "Contact"} ${recipient}`,
            ...(text(row.recipientPhone) ?? text(row.recipientEmail)
              ? { subtitle: text(row.recipientPhone) ?? text(row.recipientEmail) }
              : {}),
            ...(text(row.body) ? { meta: text(row.body) } : {}),
            ...(text(row.status) ? { status: text(row.status) } : {}),
          },
        ],
        pendingActionId
          ? {
              label: "Review",
              route: `/approvals?actionId=${encodeURIComponent(pendingActionId)}`,
            }
          : undefined
      );
      return block ? [block] : [];
    }
    case "plan_today": {
      const blocks: DisplayBlock[] = [];
      const summary = text(data.summary);
      if (summary) {
        blocks.push({ type: "text", text: summary });
      }
      const block = card(
        "tasks",
        "Today's plan",
        itemsFrom(data, ["tasks"], "Task")
      );
      if (block) {
        blocks.push(block);
      }
      return blocks;
    }
    case "get_analytics_summary":
      return analyticsBlocks(data);
    case "generate_quiz": {
      const block = card(
        "quizzes",
        "Practice quiz",
        [
          {
            ...(text(data.quizId) ? { id: text(data.quizId) } : {}),
            title: text(data.title) ?? "New quiz",
            ...(text(data.topic) ? { subtitle: text(data.topic) } : {}),
            meta: [
              text(data.subject),
              metric(data.questionCount)
                ? `${metric(data.questionCount)} questions`
                : undefined,
            ]
              .filter((part): part is string => Boolean(part))
              .join(" · "),
          },
        ],
        { label: "Open quizzes", route: "/quizzes" }
      );
      return block ? [block] : [];
    }
    case "create_study_plan":
    case "approve_study_plan": {
      const days = metric(data.totalDays);
      const examId = text(data.examId);
      const title = days ? `Study plan · ${days} days` : "Study plan";
      const block = card(
        "plans",
        "Study plan",
        [
          {
            ...(text(data.planId) ? { id: text(data.planId) } : {}),
            title,
            ...(examId ? { subtitle: `Exam ${examId}` } : {}),
            ...(metric(data.todosCreated)
              ? { meta: `${metric(data.todosCreated)} tasks created` }
              : {}),
          },
        ],
        {
          label: "Open plan",
          route: examId ? `/exams?examId=${encodeURIComponent(examId)}` : "/exams",
        }
      );
      return block ? [block] : [];
    }
    case "search_documents": {
      const chunks = array(data.chunks);
      const items = chunks
        .map((chunk, index): DisplayItem | null => {
          const row = record(chunk);
          if (!row) return null;
          const source = text(row.source) ?? text(row.documentId) ?? `Passage ${index + 1}`;
          const page = typeof row.page === "number" ? row.page : undefined;
          const pageLabel = page ? `page ${page}` : undefined;
          const score =
            typeof row.score === "number" ? `score ${row.score.toFixed(2)}` : undefined;
          const body = text(row.text);
          return {
            ...(text(row.documentId) ? { id: text(row.documentId) } : {}),
            title: source,
            ...(body ? { subtitle: body.length > 180 ? `${body.slice(0, 177)}…` : body } : {}),
            ...(pageLabel || score
              ? { meta: [pageLabel, score].filter(Boolean).join(" · ") }
              : {}),
            ...(page ? { page } : {}),
          };
        })
        .filter((row): row is DisplayItem => row !== null);

      const block = card("citations", "Sources", items, {
        label: "Open documents",
        route: "/documents",
      });
      return block ? [block] : [];
    }
    default:
      return [];
  }
}

/**
 * Builds the structured companion to an assistant reply from the tools that ran
 * during the turn. When no tool returned renderable data, the reply is kept as text.
 */
export function buildDisplayContent(
  content: string,
  actions: DisplayAction[] = []
): DisplayContent {
  const blocks: DisplayBlock[] = [];
  const seen = new Set<string>();

  for (const action of actions.slice(-MAX_ACTIONS)) {
    for (const block of blocksForAction(action)) {
      const signature =
        block.type === "card"
          ? `${block.section}:${block.items.map((row) => row.title).join("|")}`
          : `text:${block.text}`;
      if (seen.has(signature)) {
        continue;
      }
      seen.add(signature);
      blocks.push(block);
    }
  }

  if (blocks.length === 0) {
    blocks.push({ type: "text", text: content });
  }

  return { version: 1, title: null, blocks };
}
