import {
  configureStore,
  type ThunkAction,
  type UnknownAction,
} from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import {
  accountApi,
  activityApi,
  analyticsApi,
  authApi,
  chatApi,
  classNotesApi,
  contactsApi,
  devicesApi,
  documentsApi,
  examsApi,
  memoriesApi,
  notificationsApi,
  quizzesApi,
  remindersApi,
  scheduleApi,
  sessionsApi,
  pendingActionsApi,
  subjectsApi,
  todosApi,
  visionApi,
} from "@/api/registry";
import { authReducer } from "@/features/auth/auth-slice";
import { chatReducer } from "@/features/chat/chat-slice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    chat: chatReducer,
    [authApi.reducerPath]: authApi.reducer,
    [chatApi.reducerPath]: chatApi.reducer,
    [classNotesApi.reducerPath]: classNotesApi.reducer,
    [devicesApi.reducerPath]: devicesApi.reducer,
    [todosApi.reducerPath]: todosApi.reducer,
    [remindersApi.reducerPath]: remindersApi.reducer,
    [scheduleApi.reducerPath]: scheduleApi.reducer,
    [sessionsApi.reducerPath]: sessionsApi.reducer,
    [pendingActionsApi.reducerPath]: pendingActionsApi.reducer,
    [subjectsApi.reducerPath]: subjectsApi.reducer,
    [examsApi.reducerPath]: examsApi.reducer,
    [notificationsApi.reducerPath]: notificationsApi.reducer,
    [documentsApi.reducerPath]: documentsApi.reducer,
    [contactsApi.reducerPath]: contactsApi.reducer,
    [activityApi.reducerPath]: activityApi.reducer,
    [analyticsApi.reducerPath]: analyticsApi.reducer,
    [accountApi.reducerPath]: accountApi.reducer,
    [memoriesApi.reducerPath]: memoriesApi.reducer,
    [quizzesApi.reducerPath]: quizzesApi.reducer,
    [visionApi.reducerPath]: visionApi.reducer,
  },
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware()
      .concat(authApi.middleware)
      .concat(chatApi.middleware)
      .concat(classNotesApi.middleware)
      .concat(devicesApi.middleware)
      .concat(todosApi.middleware)
      .concat(remindersApi.middleware)
      .concat(scheduleApi.middleware)
      .concat(sessionsApi.middleware)
      .concat(pendingActionsApi.middleware)
      .concat(subjectsApi.middleware)
      .concat(examsApi.middleware)
      .concat(notificationsApi.middleware)
      .concat(documentsApi.middleware)
      .concat(contactsApi.middleware)
      .concat(activityApi.middleware)
      .concat(analyticsApi.middleware)
      .concat(accountApi.middleware)
      .concat(memoriesApi.middleware)
      .concat(quizzesApi.middleware)
      .concat(visionApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export type AppThunk = ThunkAction<
  Promise<void>,
  RootState,
  unknown,
  UnknownAction
>;

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
