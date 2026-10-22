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
  contactsApi,
  devicesApi,
  documentsApi,
  examsApi,
  remindersApi,
  scheduleApi,
  todosApi,
} from "@/api/registry";
import { authReducer } from "@/features/auth/auth-slice";
import { chatReducer } from "@/features/chat/chat-slice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    chat: chatReducer,
    [authApi.reducerPath]: authApi.reducer,
    [chatApi.reducerPath]: chatApi.reducer,
    [devicesApi.reducerPath]: devicesApi.reducer,
    [todosApi.reducerPath]: todosApi.reducer,
    [remindersApi.reducerPath]: remindersApi.reducer,
    [scheduleApi.reducerPath]: scheduleApi.reducer,
    [examsApi.reducerPath]: examsApi.reducer,
    [documentsApi.reducerPath]: documentsApi.reducer,
    [contactsApi.reducerPath]: contactsApi.reducer,
    [activityApi.reducerPath]: activityApi.reducer,
    [analyticsApi.reducerPath]: analyticsApi.reducer,
    [accountApi.reducerPath]: accountApi.reducer,
  },
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware()
      .concat(authApi.middleware)
      .concat(chatApi.middleware)
      .concat(devicesApi.middleware)
      .concat(todosApi.middleware)
      .concat(remindersApi.middleware)
      .concat(scheduleApi.middleware)
      .concat(examsApi.middleware)
      .concat(documentsApi.middleware)
      .concat(contactsApi.middleware)
      .concat(activityApi.middleware)
      .concat(analyticsApi.middleware)
      .concat(accountApi.middleware),
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
