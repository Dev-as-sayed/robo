import { authApi } from "@/api/auth-api";
import { notificationsApi } from "@/api/notifications-api";
import { waitForRefresh } from "@/api/base-query";
import { isTerminalAuthError } from "@/api/errors";
import { getCachedUser } from "@/auth/profile";
import { beginSignOut, clearTokens, endSignOut, getTokens } from "@/auth/tokens";
import { clearUser, finishBootstrap, setUser } from "@/features/auth/auth-slice";
import { clearPushRegistration } from "@/notifications";
import type { AppThunk } from "@/store";

export const restoreSession = (): AppThunk => async dispatch => {
  try {
    const tokens = await getTokens();

    if (!tokens) {
      dispatch(clearUser());
      return;
    }

    const cachedUser = await getCachedUser();

    try {
      const user = await dispatch(
        authApi.endpoints.me.initiate(undefined, { forceRefetch: true }),
      ).unwrap();
      dispatch(setUser(user));
    } catch (error) {
      if (isTerminalAuthError(error)) {
        await clearTokens();
        dispatch(clearUser());
      } else if (cachedUser) {
        dispatch(setUser(cachedUser));
      } else {
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
  beginSignOut();

  try {
    const pushTokenId = await clearPushRegistration();
    await waitForRefresh();
    const tokens = await getTokens();

    if (tokens && pushTokenId) {
      await dispatch(notificationsApi.endpoints.revokePushToken.initiate(pushTokenId))
        .unwrap()
        .catch(() => undefined);
    }

    if (tokens) {
      try {
        await dispatch(
          authApi.endpoints.logout.initiate({
            refreshToken: tokens.refreshToken,
          }),
        ).unwrap();
      } catch {
        // Local sign-out still proceeds when the server is unreachable.
      }
    }
  } finally {
    try {
      await clearTokens();
    } catch {
      // The local session is still cleared in Redux below.
    }
    endSignOut();
    dispatch(clearUser());
  }
};
