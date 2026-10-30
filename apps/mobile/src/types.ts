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

export type ConsentKind =
  | "MICROPHONE"
  | "CONTACTS"
  | "DOCUMENTS"
  | "CLOUD_AI";

export interface ConsentRecord {
  id: string;
  userId: string;
  kind: ConsentKind;
  granted: boolean;
  policyVersion: string;
  source: string | null;
  grantedAt: string | null;
  revokedAt: string | null;
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

export type StudySessionStatus = "active" | "paused" | "ended";

export interface StudySession {
  id: string;
  userId: string;
  subject: string | null;
  status: StudySessionStatus;
  plannedMinutes: number | null;
  extendedMinutes: number;
  pausedAt: string | null;
  totalPausedMs: number;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
}

export interface StudySessionResult {
  session: StudySession;
  studyMinutes: number;
}

export type PendingActionKind = "CALL" | "MESSAGE" | "EMAIL" | "WHATSAPP";
export type PendingActionStatus = "PENDING" | "CONFIRMED" | "REJECTED" | "EXPIRED";

export interface PendingAction {
  id: string;
  userId: string;
  contactId: string | null;
  kind: PendingActionKind;
  recipientName: string;
  recipientPhone: string | null;
  recipientEmail: string | null;
  body: string | null;
  status: PendingActionStatus;
  expiresAt: string;
  confirmedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PendingActionWithUri extends PendingAction {
  uri: string;
}

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

export type DisplayBlock =
  | { type: "text"; text: string }
  | {
      type: "card";
      section: DisplaySection;
      title: string;
      items: DisplayItem[];
      action?: { label: string; route: string };
    };

export interface DisplayContent {
  version: 1;
  title: string | null;
  blocks: DisplayBlock[];
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  voiceText: string | null;
  displayContent: DisplayContent | null;
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

export interface ConversationSummary {
  id: string;
  title: string | null;
  channel: "app" | "device";
  createdAt: string;
  updatedAt: string;
  lastMessage: ChatMessage | null;
  messageCount: number;
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
  nextAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleException {
  id: string;
  date: string;
  reason: string | null;
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
  exceptions?: ScheduleException[];
  isSkipped?: boolean;
  skippedExceptionId?: string | null;
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
  todoId?: string | null;
}

export interface StudyPlan {
  id: string;
  examId: string;
  totalDays: number;
  dailyTasks: DailyTask[];
  approvedAt: string | null;
  reminderId: string | null;
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

export interface RevisionSummary {
  examSubject: string;
  daysLeft: number;
  preparedness: number;
  remainingTopics: string[];
  missingTasks: string[];
  weakTopics: string[];
  quizAverage: number | null;
  nextTask: { title: string; dueAt: string | null } | null;
  narrative: string;
}

export interface PlanRecalculation {
  rescheduled: number;
  preparedness: number;
  daysLeft: number;
}

export type DocumentStatus =
  | "pending"
  | "uploaded"
  | "parsing"
  | "ocr"
  | "chunking"
  | "embedding"
  | "indexed"
  | "failed";

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

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string | null;
}

export interface QuizSummary {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  subject: string | null;
  topic: string | null;
  questionCount: number;
  createdAt: string;
}

export interface Quiz extends QuizSummary {
  questions: QuizQuestion[];
}

export interface QuizAttemptResult {
  questionId: string;
  selectedAnswer: string;
  isCorrect: boolean;
}

export interface QuizAttempt {
  id: string;
  userId: string;
  quizId: string;
  score: number | null;
  answeredAt: string | null;
  results: QuizAttemptResult[];
  createdAt?: string;
}

export interface QuizGenerationResult {
  quiz: Quiz;
  generatedAt: string;
}

export interface ClassNote {
  id: string;
  userId: string;
  scheduleEntryId: string | null;
  subject: string | null;
  title: string;
  content: string;
  classAt: string;
  createdAt: string;
  updatedAt: string;
}

export type MemoryCategory =
  | "general"
  | "preference"
  | "fact"
  | "goal"
  | "study";

export interface Memory {
  id: string;
  userId: string;
  content: string;
  category: MemoryCategory;
  createdAt: string;
  updatedAt: string;
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
  narrative: string;
}

export interface Subject {
  id: string;
  userId: string;
  name: string;
  color: string | null;
  createdAt: string;
  updatedAt: string;
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
  consents: unknown[];
}

export interface AnalyticsBySubject {
  subject: string;
  studyHours: number;
  completedTasks: number;
  quizAverage: number;
  recentActivities: string[];
}

export type AnalyticsRange = "day" | "week" | "month" | "year";
