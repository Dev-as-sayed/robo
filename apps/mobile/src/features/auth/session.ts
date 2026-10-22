import { authApi } from "@/api/auth-api";
import { apis } from "@/api/registry";
import { clearTokens, getTokens } from "@/auth/tokens";
import {
  clearUser,
  finishBootstrap,
  setUser,
} from "@/features/auth/auth-slice";
import { startNewConversation } from "@/features/chat/chat-slice";
import type { AppThunk } from "@/store";

export const restoreSession = (): AppThunk => async dispatch => {
  try {
    const tokens = await getTokens();

    if (tokens) {
      try {
        const user = await dispatch(
          authApi.endpoints.me.initiate(undefined, { forceRefetch: true })
        ).unwrap();
        dispatch(setUser(user));
      } catch {
        await clearTokens();
        dispatch(clearUser());
      }
    }
  } catch {
    dispatch(clearUser());
  } finally {
    dispatch(finishBootstrap());
  }
};

export const signOut = (): AppThunk => async dispatch => {
  const tokens = await getTokens();

  if (tokens) {
    try {
      await dispatch(
        authApi.endpoints.logout.initiate({
          refreshToken: tokens.refreshToken,
        })
      ).unwrap();
    } catch {
      // Local sign-out still proceeds when the server is unreachable.
    }
  }

  await clearTokens();
  dispatch(clearUser());
  dispatch(startNewConversation());

  for (const api of apis) {
    dispatch(api.util.resetApiState());
  }
};
