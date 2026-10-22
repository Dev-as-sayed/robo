import {
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { clearTokens, getTokens, setTokens } from "@/auth/tokens";
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

let refreshPromise: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  const tokens = await getTokens();
  if (!tokens) {
    return false;
  }

  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });

    if (!response.ok) {
      await clearTokens();
      return false;
    }

    const payload = (await response.json()) as ApiEnvelope<AuthResult>;
    await setTokens(payload.data.tokens);
    return true;
  } catch {
    await clearTokens();
    return false;
  }
}

function refreshOnce(): Promise<boolean> {
  refreshPromise ??= refreshTokens().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
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
    }
  }

  return result;
};
