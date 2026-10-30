import {
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { notifySessionExpired } from "@/auth/session-events";
import {
  clearTokens,
  currentAuthGeneration,
  getTokens,
  isSigningOut,
  setTokensIfCurrent,
} from "@/auth/tokens";
import { API_URL } from "@/config";
import type { ApiEnvelope, AuthResult } from "@/types";

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_URL,
  prepareHeaders: async headers => {
    const tokens = await getTokens();
    if (tokens) {
      headers.set("authorization", `Bearer ${tokens.accessToken}`);
    }
    return headers;
  },
});

const TERMINAL_REFRESH_CODES = new Set([
  "INVALID_REFRESH_TOKEN",
  "REFRESH_TOKEN_REUSED",
  "TOKEN_EXPIRED",
  "USER_NOT_FOUND",
  "ACCOUNT_NOT_FOUND",
  "ACCOUNT_SUSPENDED",
]);

const REFRESH_TIMEOUT_MS = 10_000;

let refreshPromise: Promise<boolean> | null = null;

async function failureCode(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { code?: unknown };
    return typeof body.code === "string" ? body.code : undefined;
  } catch {
    return undefined;
  }
}

async function expireSession(): Promise<void> {
  try {
    await clearTokens();
  } catch {
    // The in-memory session is still expired even if storage cleanup fails.
  }

  notifySessionExpired();
}

async function refreshTokens(): Promise<boolean> {
  if (isSigningOut()) {
    return false;
  }

  const generation = currentAuthGeneration();
  let tokens;
  try {
    tokens = await getTokens();
  } catch {
    return false;
  }

  if (!tokens) {
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      signal: controller.signal,
    });
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const code = await failureCode(response);

    if (
      response.status === 401 ||
      response.status === 403 ||
      (code && TERMINAL_REFRESH_CODES.has(code))
    ) {
      await expireSession();
    }

    return false;
  }

  let payload: ApiEnvelope<AuthResult>;
  try {
    payload = (await response.json()) as ApiEnvelope<AuthResult>;
  } catch {
    return false;
  }

  const nextTokens = payload.data?.tokens;
  if (!nextTokens) {
    return false;
  }

  try {
    return await setTokensIfCurrent(nextTokens, generation);
  } catch {
    await expireSession();
    return false;
  }
}

export function refreshOnce(): Promise<boolean> {
  refreshPromise ??= refreshTokens().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

export async function waitForRefresh(): Promise<void> {
  if (!refreshPromise) {
    return;
  }

  try {
    await refreshPromise;
  } catch {
    // A failed refresh is handled by the caller's session checks.
  }
}

function isAuthRequest(args: string | FetchArgs): boolean {
  const url = typeof args === "string" ? args : args.url;
  return url.startsWith("/auth/");
}

export const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  let result = await rawBaseQuery(args, api, extraOptions);

  if (result.error?.status === 401 && !isAuthRequest(args)) {
    const refreshed = await refreshOnce();
    if (refreshed) {
      result = await rawBaseQuery(args, api, extraOptions);

      if (result.error?.status === 401) {
        await expireSession();
      }
    } else {
      const remainingTokens = await getTokens().catch(() => null);

      if (remainingTokens) {
        return {
          error: {
            status: "CUSTOM_ERROR",
            error: "Session refresh is temporarily unavailable",
          },
        };
      }
    }
  }

  return result;
};
