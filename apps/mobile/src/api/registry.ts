import { accountApi } from "./account-api";
import { activityApi } from "./activity-api";
import { analyticsApi } from "./analytics-api";
import { authApi } from "./auth-api";
import { chatApi } from "./chat-api";
import { contactsApi } from "./contacts-api";
import { devicesApi } from "./devices-api";
import { documentsApi } from "./documents-api";
import { examsApi } from "./exams-api";
import { remindersApi } from "./reminders-api";
import { scheduleApi } from "./schedule-api";
import { todosApi } from "./todos-api";

export {
  accountApi,
  activityApi,
  analyticsApi,
  authApi,
  chatApi,
  contactsApi,
  devicesApi,
  documentsApi,
  examsApi,
  remindersApi,
  scheduleApi,
  todosApi,
};

export const apis = [
  authApi,
  chatApi,
  devicesApi,
  todosApi,
  remindersApi,
  scheduleApi,
  examsApi,
  documentsApi,
  contactsApi,
  activityApi,
  analyticsApi,
  accountApi,
];
