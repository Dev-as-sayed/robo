import { zodToJsonSchema } from "zod-to-json-schema";
import type { z } from "zod";
import {
  analyticsQuerySchema,
  chatMessageSchema,
  classNoteQuerySchema,
  createClassNoteSchema,
  createContactSchema,
  createExamSchema,
  createMemorySchema,
  createReminderSchema,
  createScheduleSchema,
  createSubjectSchema,
  completeDocumentUploadSchema,
  createTodoSchema,
  createTopicSchema,
  devicePairingSchema,
  documentUploadSchema,
  documentUploadUrlSchema,
  explainImageSchema,
  extendStudySessionSchema,
  generateQuizSchema,
  generateStudyPlanSchema,
  googleSignInSchema,
  loginSchema,
  logoutSchema,
  memoryQuerySchema,
  nudgeSettingsSchema,
  pairDeviceSchema,
  quietHoursSchema,
  refreshTokenSchema,
  registerPushTokenSchema,
  registerSchema,
  scheduleExceptionSchema,
  startStudySessionSchema,
  studySessionQuerySchema,
  submitQuizAttemptSchema,
  updateClassNoteSchema,
  updateContactSchema,
  updateDeviceSchema,
  updateExamSchema,
  updateMeSchema,
  updateMemorySchema,
  updateReminderSchema,
  updateScheduleSchema,
  updateSubjectSchema,
  updateTodoSchema,
  updateTopicSchema,
  wakePhraseSchema,
} from "@robo/shared/schemas";

type OpenApiSchema = Record<string, unknown>;

const registry: Record<string, z.ZodTypeAny> = {
  Register: registerSchema,
  Login: loginSchema,
  GoogleSignIn: googleSignInSchema,
  RefreshToken: refreshTokenSchema,
  Logout: logoutSchema,
  QuietHours: quietHoursSchema,
  WakePhrase: wakePhraseSchema,
  NudgeSettings: nudgeSettingsSchema,
  UpdateMe: updateMeSchema,
  PairDevice: pairDeviceSchema,
  UpdateDevice: updateDeviceSchema,
  DocumentUpload: documentUploadSchema,
  DocumentUploadUrl: documentUploadUrlSchema,
  CompleteDocumentUpload: completeDocumentUploadSchema,
  ChatMessage: chatMessageSchema,
  ExplainImage: explainImageSchema,
  StartStudySession: startStudySessionSchema,
  ExtendStudySession: extendStudySessionSchema,
  StudySessionQuery: studySessionQuerySchema,
  CreateTodo: createTodoSchema,
  UpdateTodo: updateTodoSchema,
  CreateSchedule: createScheduleSchema,
  UpdateSchedule: updateScheduleSchema,
  ScheduleException: scheduleExceptionSchema,
  CreateReminder: createReminderSchema,
  UpdateReminder: updateReminderSchema,
  RegisterPushToken: registerPushTokenSchema,
  CreateExam: createExamSchema,
  UpdateExam: updateExamSchema,
  GenerateStudyPlan: generateStudyPlanSchema,
  GenerateQuiz: generateQuizSchema,
  SubmitQuizAttempt: submitQuizAttemptSchema,
  CreateContact: createContactSchema,
  UpdateContact: updateContactSchema,
  CreateSubject: createSubjectSchema,
  UpdateSubject: updateSubjectSchema,
  CreateTopic: createTopicSchema,
  UpdateTopic: updateTopicSchema,
  AnalyticsQuery: analyticsQuerySchema,
  CreateMemory: createMemorySchema,
  UpdateMemory: updateMemorySchema,
  MemoryQuery: memoryQuerySchema,
  CreateClassNote: createClassNoteSchema,
  UpdateClassNote: updateClassNoteSchema,
  ClassNoteQuery: classNoteQuerySchema,
};

function component(name: string): OpenApiSchema {
  const schema = registry[name];
  if (!schema) throw new Error(`Unknown OpenAPI schema: ${name}`);
  return { $ref: `#/components/schemas/${name}` };
}

const successResponse = (description: string) => ({
  description,
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/SuccessResponse" },
    },
  },
});

const errorResponse = (description: string) => ({
  description,
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/ErrorResponse" },
    },
  },
});

interface OperationOptions {
  summary: string;
  tag: string;
  body?: string;
  query?: string;
  status?: number;
  auth?: boolean;
  multipart?: boolean;
}

function operation(options: OperationOptions) {
  const responses: Record<string, unknown> = {
    "200": successResponse("Successful response"),
    "400": errorResponse("Validation error"),
    ...(options.auth === false
      ? {}
      : {
          "401": errorResponse("Authentication required"),
          "404": errorResponse("Not found"),
        }),
  };

  if (options.status && options.status !== 200) {
    responses[String(options.status)] = successResponse("Created");
  }

  return {
    summary: options.summary,
    tags: [options.tag],
    ...(options.auth === false ? {} : { security: [{ bearerAuth: [] }] }),
    ...(options.query
      ? {
          parameters: [{ $ref: `#/components/schemas/${options.query}` }],
        }
      : {}),
    ...(options.body
      ? {
          requestBody: {
            required: true,
            content: options.multipart
              ? { "multipart/form-data": { schema: component(options.body) } }
              : { "application/json": { schema: component(options.body) } },
          },
        }
      : {}),
    responses,
  };
}

function idParam(name = "id") {
  return {
    name,
    in: "path",
    required: true,
    schema: { type: "string", format: "uuid" },
  };
}

function pathItem(method: string, op: ReturnType<typeof operation>, parameters: unknown[] = []) {
  return {
    [method]: {
      ...op,
      ...(parameters.length > 0 ? { parameters } : {}),
    },
  };
}

export function getOpenApiDocument() {
  const schemas: Record<string, OpenApiSchema> = {
    SuccessResponse: {
      type: "object",
      required: ["success", "code"],
      properties: {
        success: { type: "boolean", enum: [true] },
        code: { type: "string" },
        message: { type: "string" },
        data: { type: "object" },
        requestId: { type: "string" },
      },
    },
    ErrorResponse: {
      type: "object",
      required: ["success", "code", "message"],
      properties: {
        success: { type: "boolean", enum: [false] },
        code: { type: "string" },
        message: { type: "string" },
        details: {},
        requestId: { type: "string" },
      },
    },
  };

  for (const [name, schema] of Object.entries(registry)) {
    try {
      const json = zodToJsonSchema(schema, {
        target: "openApi3",
        $refStrategy: "none",
      }) as OpenApiSchema;
      delete json.$schema;
      schemas[name] = json;
    } catch {
      schemas[name] = { type: "object", additionalProperties: true };
    }
  }

  const paths: Record<string, unknown> = {
    "/health": pathItem(
      "get",
      {
        summary: "Service health",
        tags: ["Health"],
        security: [],
        responses: { "200": successResponse("Healthy") },
      }
    ),
    "/openapi.json": pathItem("get", {
      summary: "OpenAPI document",
      tags: ["Health"],
      security: [],
      responses: {
        "200": {
          description: "OpenAPI 3 document",
          content: { "application/json": { schema: { type: "object" } } },
        },
      },
    }),
    "/api/v1/auth/register": pathItem(
      "post",
      operation({
        summary: "Create an account",
        tag: "Auth",
        body: "Register",
        status: 201,
        auth: false,
      })
    ),
    "/api/v1/auth/login": pathItem(
      "post",
      operation({ summary: "Sign in", tag: "Auth", body: "Login", auth: false })
    ),
    "/api/v1/auth/google": pathItem(
      "post",
      operation({
        summary: "Sign in with Google",
        tag: "Auth",
        body: "GoogleSignIn",
        auth: false,
      })
    ),
    "/api/v1/auth/refresh": pathItem(
      "post",
      operation({
        summary: "Rotate a refresh token",
        tag: "Auth",
        body: "RefreshToken",
        auth: false,
      })
    ),
    "/api/v1/auth/logout": pathItem(
      "post",
      operation({
        summary: "Revoke the current session",
        tag: "Auth",
        body: "Logout",
        auth: false,
      })
    ),
    "/api/v1/users/me": {
      ...pathItem("get", operation({ summary: "Get profile", tag: "Users" })),
      patch: operation({ summary: "Update profile", tag: "Users", body: "UpdateMe" }),
    },
    "/api/v1/users/me/push-token": pathItem(
      "post",
      operation({
        summary: "Register an Expo push token",
        tag: "Users",
        body: "RegisterPushToken",
      })
    ),
    "/api/v1/devices": pathItem(
      "get",
      operation({ summary: "List devices", tag: "Devices" })
    ),
    "/api/v1/devices/pair": pathItem(
      "post",
      operation({
        summary: "Pair a device",
        tag: "Devices",
        body: "PairDevice",
        auth: false,
      })
    ),
    "/api/v1/devices/{id}": pathItem(
      "patch",
      operation({ summary: "Update a device", tag: "Devices", body: "UpdateDevice" }),
      [idParam()]
    ),
    "/api/v1/chat/messages": pathItem(
      "post",
      operation({ summary: "Send a chat message", tag: "Chat", body: "ChatMessage" })
    ),
    "/api/v1/chat/messages/stream": pathItem(
      "post",
      operation({
        summary: "Stream a chat reply (SSE)",
        tag: "Chat",
        body: "ChatMessage",
      })
    ),
    "/api/v1/chat/conversations": pathItem(
      "get",
      operation({ summary: "List conversations", tag: "Chat" })
    ),
    "/api/v1/ai/vision": pathItem(
      "post",
      operation({
        summary: "Explain a study photo",
        tag: "AI",
        body: "ExplainImage",
      })
    ),
    "/api/v1/actions": pathItem(
      "get",
      operation({ summary: "List action history", tag: "Actions" })
    ),
    "/api/v1/actions/pending": pathItem(
      "get",
      operation({ summary: "List pending confirmations", tag: "Actions" })
    ),
    "/api/v1/actions/pending/{id}/confirm": pathItem(
      "post",
      operation({ summary: "Confirm a pending action", tag: "Actions" }),
      [idParam()]
    ),
    "/api/v1/actions/pending/{id}/reject": pathItem(
      "post",
      operation({ summary: "Reject a pending action", tag: "Actions" }),
      [idParam()]
    ),
    "/api/v1/todos": {
      ...pathItem(
        "get",
        operation({ summary: "List todos", tag: "Todos" })
      ),
      post: operation({ summary: "Create a todo", tag: "Todos", body: "CreateTodo", status: 201 }),
    },
    "/api/v1/todos/{id}": {
      ...pathItem(
        "patch",
        operation({ summary: "Update a todo", tag: "Todos", body: "UpdateTodo" }),
        [idParam()]
      ),
      delete: operation({ summary: "Delete a todo", tag: "Todos" }),
    },
    "/api/v1/todos/{id}/complete": pathItem(
      "post",
      operation({ summary: "Complete a todo", tag: "Todos" }),
      [idParam()]
    ),
    "/api/v1/schedule": {
      ...pathItem("get", operation({ summary: "List schedule entries", tag: "Schedule" })),
      post: operation({
        summary: "Create a schedule entry",
        tag: "Schedule",
        body: "CreateSchedule",
        status: 201,
      }),
    },
    "/api/v1/schedule/{id}/exceptions": pathItem(
      "post",
      operation({
        summary: "Skip one occurrence",
        tag: "Schedule",
        body: "ScheduleException",
        status: 201,
      }),
      [idParam()]
    ),
    "/api/v1/reminders": {
      ...pathItem("get", operation({ summary: "List reminders", tag: "Reminders" })),
      post: operation({
        summary: "Create a reminder",
        tag: "Reminders",
        body: "CreateReminder",
        status: 201,
      }),
    },
    "/api/v1/reminders/{id}": {
      ...pathItem(
        "patch",
        operation({ summary: "Update a reminder", tag: "Reminders", body: "UpdateReminder" }),
        [idParam()]
      ),
      delete: operation({ summary: "Delete a reminder", tag: "Reminders" }),
    },
    "/api/v1/reminders/deliveries": pathItem(
      "get",
      operation({ summary: "Recent delivery attempts", tag: "Reminders" })
    ),
    "/api/v1/exams": {
      ...pathItem("get", operation({ summary: "List exams", tag: "Exams" })),
      post: operation({
        summary: "Create an exam",
        tag: "Exams",
        body: "CreateExam",
        status: 201,
      }),
    },
    "/api/v1/exams/{id}": {
      ...pathItem(
        "patch",
        operation({ summary: "Update an exam", tag: "Exams", body: "UpdateExam" }),
        [idParam()]
      ),
      delete: operation({ summary: "Delete an exam", tag: "Exams" }),
    },
    "/api/v1/exams/{id}/plan": pathItem(
      "post",
      operation({
        summary: "Generate a draft study plan",
        tag: "Exams",
        body: "GenerateStudyPlan",
        status: 201,
      }),
      [idParam()]
    ),
    "/api/v1/exams/{id}/plan/approve": pathItem(
      "post",
      operation({ summary: "Approve a plan and create todos", tag: "Exams" }),
      [idParam()]
    ),
    "/api/v1/exams/{id}/plan/recalculate": pathItem(
      "post",
      operation({ summary: "Reschedule remaining tasks", tag: "Exams" }),
      [idParam()]
    ),
    "/api/v1/exams/{id}/readiness": pathItem(
      "get",
      operation({ summary: "Readiness score", tag: "Exams" }),
      [idParam()]
    ),
    "/api/v1/documents": {
      ...pathItem("get", operation({ summary: "List documents", tag: "Documents" })),
      post: operation({
        summary: "Upload a document",
        tag: "Documents",
        body: "DocumentUpload",
        multipart: true,
        status: 201,
      }),
    },
    "/api/v1/documents/upload-url": pathItem(
      "post",
      operation({
        summary: "Create a signed document upload URL",
        tag: "Documents",
        body: "DocumentUploadUrl",
        status: 201,
      })
    ),
    "/api/v1/documents/{id}": {
      ...pathItem("get", operation({ summary: "Get a document", tag: "Documents" }), [
        idParam(),
      ]),
      delete: operation({ summary: "Delete a document", tag: "Documents" }),
    },
    "/api/v1/documents/{id}/complete": pathItem(
      "post",
      operation({
        summary: "Confirm a signed upload",
        tag: "Documents",
        body: "CompleteDocumentUpload",
      }),
      [idParam()]
    ),
    "/api/v1/documents/{id}/download-url": pathItem(
      "get",
      operation({ summary: "Create a signed download URL", tag: "Documents" }),
      [idParam()]
    ),
    "/api/v1/quizzes": pathItem(
      "get",
      operation({ summary: "List quizzes", tag: "Quizzes" })
    ),
    "/api/v1/quizzes/generate": pathItem(
      "post",
      operation({
        summary: "Generate a validated quiz",
        tag: "Quizzes",
        body: "GenerateQuiz",
        status: 201,
      })
    ),
    "/api/v1/quizzes/{id}": pathItem(
      "get",
      operation({ summary: "Get quiz questions", tag: "Quizzes" }),
      [idParam()]
    ),
    "/api/v1/quizzes/{id}/attempts": {
      ...pathItem(
        "post",
        operation({
          summary: "Record quiz answers",
          tag: "Quizzes",
          body: "SubmitQuizAttempt",
          status: 201,
        }),
        [idParam()]
      ),
      get: operation({ summary: "List attempts for a quiz", tag: "Quizzes" }),
    },
    "/api/v1/contacts": {
      ...pathItem("get", operation({ summary: "List contacts", tag: "Contacts" })),
      post: operation({
        summary: "Create a contact",
        tag: "Contacts",
        body: "CreateContact",
        status: 201,
      }),
    },
    "/api/v1/contacts/{id}": {
      ...pathItem(
        "patch",
        operation({ summary: "Update a contact", tag: "Contacts", body: "UpdateContact" }),
        [idParam()]
      ),
      delete: operation({ summary: "Delete a contact", tag: "Contacts" }),
    },
    "/api/v1/subjects": {
      ...pathItem("get", operation({ summary: "List subjects", tag: "Subjects" })),
      post: operation({
        summary: "Create a subject",
        tag: "Subjects",
        body: "CreateSubject",
        status: 201,
      }),
    },
    "/api/v1/subjects/{id}/topics": pathItem(
      "post",
      operation({
        summary: "Add a topic",
        tag: "Subjects",
        body: "CreateTopic",
        status: 201,
      }),
      [idParam()]
    ),
    "/api/v1/sessions": {
      ...pathItem("get", operation({ summary: "List study sessions", tag: "Sessions" })),
      post: operation({
        summary: "Start a study session",
        tag: "Sessions",
        body: "StartStudySession",
        status: 201,
      }),
    },
    "/api/v1/sessions/active": pathItem(
      "get",
      operation({ summary: "Get the running session", tag: "Sessions" })
    ),
    "/api/v1/sessions/{id}/end": pathItem(
      "post",
      operation({ summary: "End a study session", tag: "Sessions" }),
      [idParam()]
    ),
    "/api/v1/sessions/{id}/extend": pathItem(
      "post",
      operation({
        summary: "Extend a study session",
        tag: "Sessions",
        body: "ExtendStudySession",
      }),
      [idParam()]
    ),
    "/api/v1/analytics/summary": pathItem(
      "get",
      operation({ summary: "Study analytics summary", tag: "Analytics" })
    ),
    "/api/v1/analytics/subjects/{id}": pathItem(
      "get",
      operation({ summary: "Per-subject trends", tag: "Analytics" }),
      [idParam()]
    ),
    "/api/v1/memories": {
      ...pathItem("get", operation({ summary: "List memories", tag: "Memories" })),
      post: operation({
        summary: "Save a memory",
        tag: "Memories",
        body: "CreateMemory",
        status: 201,
      }),
    },
    "/api/v1/memories/{id}": pathItem(
      "delete",
      operation({ summary: "Forget a memory", tag: "Memories" }),
      [idParam()]
    ),
    "/api/v1/class-notes": {
      ...pathItem("get", operation({ summary: "Search class notes", tag: "Class notes" })),
      post: operation({
        summary: "Save a class note",
        tag: "Class notes",
        body: "CreateClassNote",
        status: 201,
      }),
    },
    "/api/v1/class-notes/{id}": {
      ...pathItem(
        "patch",
        operation({
          summary: "Update a class note",
          tag: "Class notes",
          body: "UpdateClassNote",
        }),
        [idParam()]
      ),
      delete: operation({ summary: "Delete a class note", tag: "Class notes" }),
    },
  };

  return {
    openapi: "3.0.3",
    info: {
      title: "Robo Student Assistant API",
      version: "1.0.0",
      description:
        "English-only university assistant. JSON envelopes use `success`, `code`, optional `message`/`data` and `requestId`.",
    },
    servers: [{ url: "/api/v1" }],
    tags: [
      "Auth",
      "Users",
      "Devices",
      "Chat",
      "Actions",
      "Todos",
      "Schedule",
      "Reminders",
      "Exams",
      "Documents",
      "Quizzes",
      "Contacts",
      "Subjects",
      "Sessions",
      "Analytics",
      "Memories",
      "Class notes",
    ].map(name => ({ name })),
    paths,
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
      schemas,
    },
  };
}
