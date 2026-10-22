export interface ApiEnvelope<T> {
  success: boolean;
  code: string;
  message?: string;
  data: T;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  region: string | null;
  brand: string | null;
  locale: string;
  timezone: string;
  quietHours: QuietHours | null;
  wakePhrase: string;
  nudgeSettings: NudgeSettings | null;
  cloudAiForDocs: boolean;
  guardianConsent: boolean;
  hasPassword: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  accessTokenExpiresIn: number;
  refreshTokenExpiresAt: string;
}

export interface AuthResult {
  user: User;
  tokens: TokenPair;
}

export type ChatRole = "USER" | "ASSISTANT" | "SYSTEM" | "TOOL";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  voiceText: string | null;
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string | null;
  channel: "app" | "device";
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface ChatTurnResult {
  conversation: Omit<Conversation, "messages">;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  toolCallCount: number;
}

export type DeviceStatus = "PENDING" | "ONLINE" | "OFFLINE" | "REVOKED";

export interface Device {
  id: string;
  deviceId: string;
  name: string | null;
  firmwareVersion: string | null;
  locale: string | null;
  status: DeviceStatus;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PairingCode {
  code: string;
  expiresAt: string;
  qrPayload: string;
}

export type TodoPriority = "low" | "medium" | "high" | "urgent";
export type TodoStatus = "pending" | "completed" | "snoozed";

export interface Todo {
  id: string;
  title: string;
  notes: string | null;
  dueAt: string | null;
  subject: string | null;
  priority: TodoPriority;
  status: TodoStatus;
  createdAt: string;
  updatedAt: string;
}

export type ReminderChannel = "device" | "phone" | "push";
export type ReminderStatus = "active" | "completed" | "snoozed" | "expired";

export interface Reminder {
  id: string;
  text: string;
  at: string | null;
  rrule: string | null;
  channels: ReminderChannel[];
  linkedEntity: "todo" | "exam" | "schedule" | null;
  status: ReminderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleEntry {
  id: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  subject: string | null;
  room: string | null;
  teacher: string | null;
  createdAt: string;
}

export type ExamStatus = "draft" | "active" | "completed";

export interface Exam {
  id: string;
  subject: string;
  date: string;
  topics: string[];
  weight: number | null;
  status: ExamStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DailyTask {
  id: string;
  day: number;
  title: string;
  completed: boolean;
}

export interface StudyPlan {
  id: string;
  examId: string;
  totalDays: number;
  dailyTasks: DailyTask[];
  createdAt: string;
  updatedAt: string;
}

export interface PlanGenerationResult {
  plan: StudyPlan;
  dailyTasks: DailyTask[];
}

export interface Readiness {
  preparedness: number;
  remainingTopics: string[];
  missingTasks: string[];
}

export type DocumentStatus = "uploaded" | "processing" | "processed" | "failed";

export interface StudyDocument {
  id: string;
  originalName: string;
  size: number;
  mimeType: string;
  status: DocumentStatus;
  subject: string | null;
  chunkCount: number;
  createdAt: string;
}

export interface Contact {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  group: string | null;
  createdAt: string;
}

export type ActionLogStatus = "SUCCESS" | "ERROR" | "CONFIRMATION_REQUIRED";

export interface ActionLogEntry {
  id: string;
  conversationId: string | null;
  toolName: string;
  input: unknown;
  output: unknown;
  status: ActionLogStatus;
  error: string | null;
  durationMs: number;
  createdAt: string;
}

export interface AnalyticsSummary {
  totalStudyHours: number;
  completedTasks: number;
  completedQuizzes: number;
  activeReminders: number;
  upcomingExams: number;
  streakDays: number;
}

export interface QuietHours {
  enabled: boolean;
  start: string;
  end: string;
}

export interface NudgeSettings {
  enabled: boolean;
  maxPerDay: number;
  types: {
    reminders: boolean;
    study: boolean;
    exams: boolean;
    tasks: boolean;
  };
}

export type WakePhrase = "hey robo" | "ok robo" | "hello robo";

export interface AccountPreferences {
  name?: string;
  locale?: string;
  timezone?: string;
  quietHours?: QuietHours | null;
  wakePhrase?: WakePhrase;
  nudgeSettings?: NudgeSettings | null;
  cloudAiForDocs?: boolean;
}

export interface DataExport {
  exportedAt: string;
  user: User;
  devices: unknown[];
  todos: unknown[];
  reminders: unknown[];
  scheduleEntries: unknown[];
  exams: unknown[];
  studyPlans: unknown[];
  documents: unknown[];
  quizzes: unknown[];
  quizAttempts: unknown[];
  contacts: unknown[];
  studySessions: unknown[];
  conversations: unknown[];
  actionLogs: unknown[];
}

export interface AnalyticsBySubject {
  subject: string;
  studyHours: number;
  completedTasks: number;
  quizAverage: number;
  recentActivities: string[];
}

export type AnalyticsRange = "day" | "week" | "month" | "year";
