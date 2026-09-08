import {
  authSessionSchema,
  authUserSchema,
  registerResponseSchema,
  startOAuthResponseSchema,
  type AuthSession,
  type AuthUser,
  type RegisterRequest,
  type RegisterResponse,
  type RegisterPendingResponse,
  type LoginRequest,
  type StartOAuthRequest,
  type StartOAuthResponse,
  type OAuthLoginRequest,
} from "@expirymate/shared";
import type { ZodType } from "zod";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { withAsyncTimeout } from "../shared/async-timeout";
import { captureStartupBootstrapIssue } from "./bootstrap-diagnostics";
import { ApiError, publicRequest } from "./api-transport";

export const AUTH_STORAGE_TIMEOUT_MS = 8_000;

const AUTH_USER_STORAGE_KEY = "expirymate.authUser.v2";
const REFRESH_TOKEN_STORAGE_KEY = "expirymate.refreshToken.v2";
const LEGACY_AUTH_SESSION_STORAGE_KEY = "expirymate.authSession.v1";

let accessToken: string | null = null;
let currentUser: AuthUser | null = null;
let sessionPromise: Promise<AuthSession | null> | null = null;
/** Single-flight mutex so parallel 401s share one refresh instead of racing. */
let refreshInFlight: Promise<AuthSession | null> | null = null;
const authSessionClearedListeners = new Set<() => void>();

/**
 * Lets the React session boundary invalidate cached user state when the API
 * client discovers a terminal refresh failure outside the auth query itself.
 */
export function subscribeToAuthSessionCleared(listener: () => void) {
  authSessionClearedListeners.add(listener);
  return () => {
    authSessionClearedListeners.delete(listener);
  };
}

function notifyAuthSessionCleared() {
  for (const listener of authSessionClearedListeners) {
    try {
      listener();
    } catch {
      // Session cleanup must not fail because a UI subscriber was unmounted.
    }
  }
}

export const hasRegisteredAccessToken = () => Boolean(accessToken);

export async function requireRegisteredSession() {
  if (!sessionPromise) {
    sessionPromise = loadRegisteredSession().catch((error: unknown) => {
      sessionPromise = null;
      throw error;
    });
  }

  const session = await sessionPromise;

  if (!session) {
    throw new Error("로그인이 필요해요. 계정으로 이어가 주세요.");
  }

  return session;
}

/** Restores a registered session from storage, or returns null (no anonymous fallback). */
export async function restoreRegisteredSession(): Promise<AuthSession | null> {
  if (!sessionPromise) {
    sessionPromise = loadRegisteredSession().catch((error: unknown) => {
      sessionPromise = null;
      throw error;
    });
  }

  return sessionPromise;
}

async function loadRegisteredSession(): Promise<AuthSession | null> {
  if (accessToken && currentUser?.accountType === "registered") {
    return { user: currentUser, accessToken };
  }

  await runAuthStorageOperation(
    AsyncStorage.removeItem(LEGACY_AUTH_SESSION_STORAGE_KEY),
    "async-storage.remove-legacy-session",
  ).catch(() => undefined);

  const [storedUser, refreshToken] = await Promise.all([
    runAuthStorageOperation(
      AsyncStorage.getItem(AUTH_USER_STORAGE_KEY),
      "async-storage.read-user",
    ),
    runAuthStorageOperation(
      SecureStore.getItemAsync(REFRESH_TOKEN_STORAGE_KEY),
      "secure-store.read-refresh-token",
    ),
  ]);

  if (!storedUser || !refreshToken) {
    await clearAuthSession();
    return null;
  }

  let parsed: AuthUser;
  try {
    parsed = authUserSchema.parse(JSON.parse(storedUser));
  } catch {
    await clearAuthSession();
    return null;
  }

  if (parsed.accountType !== "registered") {
    await clearAuthSession();
    return null;
  }

  try {
    currentUser = parsed;
    return await refreshRegisteredSessionSingleFlight();
  } catch (error) {
    accessToken = null;
    currentUser = null;
    throw error;
  }
}

export async function tryRefreshRegisteredSession() {
  return refreshRegisteredSessionSingleFlight();
}

/**
 * One in-flight refresh at a time. Parallel 401 handlers await the same promise
 * so a loser never clears a winner's newly rotated session.
 */
async function refreshRegisteredSessionSingleFlight(): Promise<AuthSession | null> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    const refreshToken = await runAuthStorageOperation(
      SecureStore.getItemAsync(REFRESH_TOKEN_STORAGE_KEY),
      "secure-store.read-refresh-token",
    );

    if (!refreshToken) {
      return null;
    }

    try {
      const session = await refreshSession(refreshToken);
      if (!session || session.user.accountType !== "registered") {
        await clearAuthSession();
        return null;
      }
      return session;
    } catch (error) {
      if (isTerminalRefreshError(error)) {
        await clearAuthSession();
        return null;
      }
      throw error;
    }
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

function isTerminalRefreshError(error: unknown) {
  return (
    error instanceof ApiError &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 408 &&
    error.status !== 429
  );
}

async function authRequestWithOptionalBearer<T>(
  path: string,
  init?: RequestInit,
  schema?: ZodType<T>,
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return publicRequest<T>(
    path,
    {
      ...init,
      headers,
    },
    schema,
  );
}

async function refreshSession(refreshToken: string) {
  const session = await publicRequest<AuthSession>(
    "/auth/refresh",
    {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    },
    authSessionSchema,
  );

  return persistAuthSession(session);
}

async function persistAuthSession(session: AuthSession) {
  if (session.user.accountType !== "registered") {
    await clearAuthSession();
    throw new Error("등록된 계정으로만 이어갈 수 있어요.");
  }

  if (!session.refreshToken) {
    await clearAuthSession();
    throw new Error("로그인 갱신 정보를 받지 못했어요. 다시 시도해 주세요.");
  }

  try {
    await runAuthStorageOperation(
      SecureStore.setItemAsync(REFRESH_TOKEN_STORAGE_KEY, session.refreshToken),
      "secure-store.write-refresh-token",
    );
    await runAuthStorageOperation(
      AsyncStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(session.user)),
      "async-storage.write-user",
    );
  } catch (error) {
    // Never expose a session in memory when either half of persistence failed.
    // clearAuthSession also removes a refresh token written before AsyncStorage failed.
    await clearAuthSession();
    throw error;
  }

  accessToken = session.accessToken;
  currentUser = session.user;
  sessionPromise = Promise.resolve(session);

  return session;
}

export async function clearAuthSession() {
  accessToken = null;
  currentUser = null;
  sessionPromise = null;
  refreshInFlight = null;
  try {
    // Local cleanup must never hold the signed-out transition hostage. Report
    // individual failures, but let React move to the login screen.
    await Promise.allSettled([
      runAuthStorageOperation(
        AsyncStorage.removeItem(AUTH_USER_STORAGE_KEY),
        "async-storage.remove-user",
      ),
      runAuthStorageOperation(
        AsyncStorage.removeItem(LEGACY_AUTH_SESSION_STORAGE_KEY),
        "async-storage.remove-legacy-session",
      ),
      runAuthStorageOperation(
        SecureStore.deleteItemAsync(REFRESH_TOKEN_STORAGE_KEY),
        "secure-store.remove-refresh-token",
      ),
    ]);
  } finally {
    notifyAuthSessionCleared();
  }
}

export const register = async (
  payload: RegisterRequest,
): Promise<RegisterResponse> => {
  const result = await authRequestWithOptionalBearer<RegisterResponse>(
    "/auth/register",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    registerResponseSchema,
  );

  if (isRegisterPendingResponse(result)) {
    return result;
  }

  return persistAuthSession(result);
};

function isRegisterPendingResponse(
  value: RegisterResponse,
): value is RegisterPendingResponse {
  return (
    "requiresEmailVerification" in value &&
    value.requiresEmailVerification === true &&
    typeof value.email === "string"
  );
}

export const login = async (payload: LoginRequest) =>
  persistAuthSession(
    await authRequestWithOptionalBearer<AuthSession>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      authSessionSchema,
    ),
  );

export const logout = async () => {
  // Unregister this device's push token while the session is still valid.
  const { unregisterDevicePushToken } = await import("./notifications");
  await unregisterDevicePushToken().catch(() => null);

  const refreshToken = await runAuthStorageOperation(
    SecureStore.getItemAsync(REFRESH_TOKEN_STORAGE_KEY),
    "secure-store.read-refresh-token-for-logout",
  ).catch(() => null);

  if (refreshToken) {
    await publicRequest<{ ok: boolean }>("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }).catch(() => null);
  }

  await clearAuthSession();
};

function runAuthStorageOperation<T>(
  operation: PromiseLike<T>,
  stage: string,
): Promise<T> {
  return withAsyncTimeout(
    operation,
    AUTH_STORAGE_TIMEOUT_MS,
    stage,
    "로그인 정보를 확인하는 데 시간이 오래 걸리고 있어요. 다시 시도해 주세요.",
  ).catch((error: unknown) => {
    captureStartupBootstrapIssue(`auth-storage.${stage}`, error, {
      timeout_ms: AUTH_STORAGE_TIMEOUT_MS,
    });
    throw error;
  });
}

export const getEmailVerificationStatus = (email: string) =>
  publicRequest<{ verified: boolean }>(
    `/auth/email/verification-status?email=${encodeURIComponent(email)}`,
  );

export const verifyEmail = async (token: string) =>
  persistAuthSession(
    await publicRequest<AuthSession>(
      "/auth/email/verify",
      {
        method: "POST",
        body: JSON.stringify({ token }),
      },
      authSessionSchema,
    ),
  );

export const forgotPassword = (email: string) =>
  publicRequest<{ ok: boolean }>("/auth/password/forgot", {
    method: "POST",
    body: JSON.stringify({ email }),
  });

export const resetPassword = (token: string, password: string) =>
  publicRequest<{ ok: boolean }>("/auth/password/reset", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });

export const startOAuth = (payload: StartOAuthRequest) =>
  publicRequest<StartOAuthResponse>(
    "/auth/oauth/start",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    startOAuthResponseSchema,
  );

export const oauthLogin = async (
  provider: "apple" | "google" | "kakao" | "naver",
  payload: OAuthLoginRequest,
) =>
  persistAuthSession(
    await authRequestWithOptionalBearer<AuthSession>(
      `/auth/oauth/${provider}`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      authSessionSchema,
    ),
  );
