import { z } from "zod";
import { USER_ROLES, USER_STATUSES } from "../users/roles";

const emailSchema = z.string().trim().toLowerCase().email();
const passwordSchema = z.string().min(8).max(128);
const timeZoneSchema = z
  .string()
  .min(1)
  .max(64)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Invalid IANA time zone");

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(2).max(50),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const googleSignInSchema = z.object({
  idToken: z.string().min(1),
});

export const refreshTokenSchema = z
  .object({
    refreshToken: z.string().min(1).optional(),
    token: z.string().min(1).optional(),
  })
  .refine((value) => Boolean(value.refreshToken ?? value.token), {
    message: "refreshToken is required",
    path: ["refreshToken"],
  })
  .transform((value) => ({ refreshToken: value.refreshToken ?? value.token! }));

export const logoutSchema = z.object({
  refreshToken: z.string().min(1).optional(),
  allSessions: z.boolean().default(false),
});

export const quietHoursSchema = z.object({
  enabled: z.boolean(),
  start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
});

export const SUPPORTED_WAKE_PHRASES = ["hey robo", "ok robo", "hello robo"] as const;

export const wakePhraseSchema = z.enum(SUPPORTED_WAKE_PHRASES);

export const nudgeSettingsSchema = z.object({
  enabled: z.boolean(),
  maxPerDay: z.number().int().min(0).max(20),
  types: z.object({
    reminders: z.boolean(),
    study: z.boolean(),
    exams: z.boolean(),
    tasks: z.boolean(),
  }),
});

export const updateMeSchema = z.object({
  name: z.string().trim().min(2).max(50).optional(),
  password: passwordSchema.optional(),
  locale: z.string().min(2).max(10).optional(),
  timezone: timeZoneSchema.optional(),
  quietHours: quietHoursSchema.nullable().optional(),
  wakePhrase: wakePhraseSchema.optional(),
  nudgeSettings: nudgeSettingsSchema.nullable().optional(),
  cloudAiForDocs: z.boolean().optional(),
  guardianConsent: z.boolean().optional(),
});

export const userRoleSchema = z.enum(USER_ROLES);

export const userStatusSchema = z.enum(USER_STATUSES);

const scopeValueSchema = z.string().trim().min(1).max(100);

export const updateUserRoleSchema = z.object({
  role: userRoleSchema,
  region: scopeValueSchema.nullable().optional(),
  brand: scopeValueSchema.nullable().optional(),
});

export const updateUserStatusSchema = z
  .object({
    status: userStatusSchema,
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .refine((value) => value.status === "ACTIVE" || Boolean(value.reason), {
    message: "reason is required when suspending an account",
    path: ["reason"],
  });

export const updateUserScopeSchema = z.object({
  region: scopeValueSchema.nullable(),
  brand: scopeValueSchema.nullable(),
});

export const adminUserQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: userRoleSchema.optional(),
  status: userStatusSchema.optional(),
  search: z.string().trim().min(1).max(100).optional(),
  region: scopeValueSchema.optional(),
  brand: scopeValueSchema.optional(),
});

export const adminUserParamSchema = z.object({
  id: z.string().uuid(),
});

export const deviceParamSchema = z.object({
  id: z.string().uuid(),
});

export const pairDeviceSchema = z.object({
  code: z.string().trim().min(6).max(32),
  deviceId: z.string().trim().min(3).max(100),
  name: z.string().trim().min(1).max(100).optional(),
  firmwareVersion: z.string().trim().max(50).optional(),
  locale: z.string().trim().min(2).max(10).optional(),
});

export const devicePairingSchema = pairDeviceSchema;

export const updateDeviceSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  locale: z.string().trim().min(2).max(10).optional(),
});

export const chatMessageSchema = z.object({
  content: z.string().trim().min(1).max(4000),
  conversationId: z.string().uuid().optional(),
  channel: z.enum(["app", "device"]).default("app"),
});

export const chatConversationParamSchema = z.object({
  id: z.string().uuid(),
});

export const chatConversationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const chatMessageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const actionLogQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const startStudySessionSchema = z.object({
  subject: z.string().trim().min(1).max(100).optional(),
  plannedMinutes: z.number().int().min(5).max(480).optional(),
});

export const extendStudySessionSchema = z.object({
  minutes: z.number().int().min(1).max(180),
});

export const studySessionQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createTodoSchema = z.object({
  title: z.string().min(1).max(200),
  due: z.coerce.date().optional(),
  subject: z.string().min(1).max(100).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  notes: z.string().max(5000).optional(),
});

export const updateTodoSchema = createTodoSchema.partial().extend({
  status: z.enum(["pending", "completed", "snoozed"]).optional(),
});

export const createScheduleSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date().optional(),
  allDay: z.boolean().optional(),
  subject: z.string().max(100).optional(),
  room: z.string().max(100).optional(),
  teacher: z.string().max(100).optional(),
  alertLeadMinutes: z.number().int().min(0).max(240).optional(),
});

export const updateScheduleSchema = createScheduleSchema.partial();

export const scheduleExceptionSchema = z.object({
  date: z.coerce.date(),
  reason: z.string().max(500).optional(),
});

export const createReminderSchema = z.object({
  text: z.string().min(1).max(500),
  at: z.coerce.date().optional(),
  rrule: z.string().max(500).optional(),
  channels: z.array(z.enum(["device", "phone", "push"])).min(1).optional(),
  linkedEntity: z.enum(["todo", "exam", "schedule"]).optional(),
});

export const updateReminderSchema = createReminderSchema.partial().extend({
  status: z.enum(["active", "completed", "snoozed", "expired"]).optional(),
});

export const registerPushTokenSchema = z.object({
  token: z.string().trim().min(8).max(4096),
  platform: z.enum(["ios", "android"]),
});

export const consentKindSchema = z.enum([
  "MICROPHONE",
  "CONTACTS",
  "DOCUMENTS",
  "CLOUD_AI",
]);

export const updateConsentSchema = z.object({
  granted: z.boolean(),
  policyVersion: z.string().trim().min(1).max(40).optional(),
  source: z.string().trim().min(1).max(80).optional(),
});

export const createExamSchema = z.object({
  subject: z.string().min(1).max(100),
  date: z.coerce.date(),
  topics: z.array(z.string().min(1)).optional(),
  weight: z.number().min(0).max(100).optional(),
});

export const updateExamSchema = createExamSchema.partial().extend({
  status: z.enum(["draft", "active", "completed"]).optional(),
});

export const generateStudyPlanSchema = z.object({
  dailyLimit: z.number().int().positive().optional(),
  includeReviews: z.boolean().optional(),
});

export const generateQuizSchema = z.object({
  subject: z.string().min(1).max(100),
  topic: z.string().min(1).max(200),
  questionCount: z.number().int().min(1).max(50),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
});

export const submitQuizAttemptSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        selectedAnswer: z.string().min(1),
      })
    )
    .min(1),
});

export const createContactSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().min(3).max(30).optional(),
  email: z.string().email().optional(),
  group: z.string().max(100).optional(),
});

export const updateContactSchema = createContactSchema.partial();

export const createSubjectSchema = z.object({
  name: z.string().trim().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Expected a #RRGGBB color").optional(),
});

export const updateSubjectSchema = createSubjectSchema.partial();

export const subjectParamSchema = z.object({
  id: z.string().uuid(),
});

export const createTopicSchema = z.object({
  name: z.string().trim().min(1).max(200),
  masteryScore: z.number().int().min(0).max(100).optional(),
});

export const updateTopicSchema = createTopicSchema.partial();

export const topicParamSchema = z.object({
  id: z.string().uuid(),
  topicId: z.string().uuid(),
});

export const analyticsQuerySchema = z.object({
  range: z.enum(["day", "week", "month", "year"]).default("week"),
});

export const memoryCategorySchema = z.enum([
  "general",
  "preference",
  "fact",
  "goal",
  "study",
]);

export const createMemorySchema = z.object({
  content: z.string().trim().min(1).max(1000),
  category: memoryCategorySchema.optional(),
});

export const updateMemorySchema = z
  .object({
    content: z.string().trim().min(1).max(1000).optional(),
    category: memoryCategorySchema.optional(),
  })
  .refine((value) => value.content !== undefined || value.category !== undefined, {
    message: "Provide content or category",
  });

export const memoryQuerySchema = z.object({
  category: memoryCategorySchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const createClassNoteSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    subject: z.string().trim().min(1).max(100).optional(),
    content: z.string().trim().min(1).max(10000),
    classAt: z.string().datetime({ offset: true }).optional(),
    scheduleEntryId: z.string().uuid().optional(),
  })
  .refine((value) => Boolean(value.title || value.scheduleEntryId), {
    message: "Provide a title or scheduleEntryId",
  });

export const updateClassNoteSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    subject: z.string().trim().max(100).optional(),
    content: z.string().trim().min(1).max(10000).optional(),
    classAt: z.string().datetime({ offset: true }).optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "Provide at least one field",
  });

export const classNoteQuerySchema = z.object({
  subject: z.string().trim().min(1).max(100).optional(),
  search: z.string().trim().min(1).max(200).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const documentUploadUrlSchema = z.object({
  originalName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(200),
  size: z.number().int().positive(),
  subject: z.string().trim().min(1).max(100).optional(),
});

export const completeDocumentUploadSchema = z.object({
  size: z.number().int().positive().optional(),
  checksum: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{64}$/i, "checksum must be a SHA-256 hex digest")
    .optional(),
});

export const documentUploadSchema = z.object({
  subject: z.string().trim().min(1).max(100).optional(),
  file: z.any().describe("Binary document file"),
});

export const documentParamSchema = z.object({
  id: z.string().uuid(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type GoogleSignInInput = z.infer<typeof googleSignInSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type UpdateMeInput = z.infer<typeof updateMeSchema>;
export type UserRoleInput = z.infer<typeof userRoleSchema>;
export type UserStatusInput = z.infer<typeof userStatusSchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
export type UpdateUserScopeInput = z.infer<typeof updateUserScopeSchema>;
export type AdminUserQueryInput = z.infer<typeof adminUserQuerySchema>;
export type AdminUserParamInput = z.infer<typeof adminUserParamSchema>;
export type WakePhraseInput = z.infer<typeof wakePhraseSchema>;
export type NudgeSettingsInput = z.infer<typeof nudgeSettingsSchema>;
export type DevicePairingInput = z.infer<typeof devicePairingSchema>;
export type PairDeviceInput = z.infer<typeof pairDeviceSchema>;
export type UpdateDeviceInput = z.infer<typeof updateDeviceSchema>;
export type DeviceParamInput = z.infer<typeof deviceParamSchema>;
export type DocumentUploadUrlInput = z.infer<typeof documentUploadUrlSchema>;
export type CompleteDocumentUploadInput = z.infer<typeof completeDocumentUploadSchema>;
export type DocumentParamInput = z.infer<typeof documentParamSchema>;
export const explainImageSchema = z.object({
  imageBase64: z
    .string()
    .min(100)
    .max(6_990_516)
    .regex(/^[A-Za-z0-9+/=]+$/, "Invalid image data"),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  question: z.string().trim().min(1).max(1_000).optional(),
});

export type ExplainImageInput = z.infer<typeof explainImageSchema>;

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
export type ChatConversationParamInput = z.infer<typeof chatConversationParamSchema>;
export type ChatConversationQueryInput = z.infer<typeof chatConversationQuerySchema>;
export type ChatMessageQueryInput = z.infer<typeof chatMessageQuerySchema>;
export type ActionLogQueryInput = z.infer<typeof actionLogQuerySchema>;
export type StartStudySessionInput = z.infer<typeof startStudySessionSchema>;
export type ExtendStudySessionInput = z.infer<typeof extendStudySessionSchema>;
export type StudySessionQueryInput = z.infer<typeof studySessionQuerySchema>;
export type QuietHoursInput = z.infer<typeof quietHoursSchema>;
export type CreateTodoInput = z.infer<typeof createTodoSchema>;
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>;
export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;
export type ScheduleExceptionInput = z.infer<typeof scheduleExceptionSchema>;
export type CreateReminderInput = z.infer<typeof createReminderSchema>;
export type UpdateReminderInput = z.infer<typeof updateReminderSchema>;
export type RegisterPushTokenInput = z.infer<typeof registerPushTokenSchema>;
export type ConsentKindInput = z.infer<typeof consentKindSchema>;
export type UpdateConsentInput = z.infer<typeof updateConsentSchema>;
export type CreateExamInput = z.infer<typeof createExamSchema>;
export type UpdateExamInput = z.infer<typeof updateExamSchema>;
export type GenerateStudyPlanInput = z.infer<typeof generateStudyPlanSchema>;
export type GenerateQuizInput = z.infer<typeof generateQuizSchema>;
export type SubmitQuizAttemptInput = z.infer<typeof submitQuizAttemptSchema>;
export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;
export type UpdateSubjectInput = z.infer<typeof updateSubjectSchema>;
export type SubjectParamInput = z.infer<typeof subjectParamSchema>;
export type CreateTopicInput = z.infer<typeof createTopicSchema>;
export type UpdateTopicInput = z.infer<typeof updateTopicSchema>;
export type TopicParamInput = z.infer<typeof topicParamSchema>;
export type AnalyticsQueryInput = z.infer<typeof analyticsQuerySchema>;
export type CreateMemoryInput = z.infer<typeof createMemorySchema>;
export type UpdateMemoryInput = z.infer<typeof updateMemorySchema>;
export type MemoryQueryInput = z.infer<typeof memoryQuerySchema>;
export type CreateClassNoteInput = z.infer<typeof createClassNoteSchema>;
export type UpdateClassNoteInput = z.infer<typeof updateClassNoteSchema>;
export type ClassNoteQueryInput = z.infer<typeof classNoteQuerySchema>;
