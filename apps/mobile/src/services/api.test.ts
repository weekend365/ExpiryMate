import type { AuthSession, AuthUser, DashboardSummary } from "@expirymate/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const stores = vi.hoisted(() => ({
  asyncStorage: new Map<string, string>(),
  secureStore: new Map<string, string>(),
  fetch: vi.fn(),
  unregisterDevicePushToken: vi.fn(async () => ({ ok: true, skipped: false })),
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => stores.asyncStorage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      stores.asyncStorage.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      stores.asyncStorage.delete(key);
    }),
  },
}));

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async (key: string) => stores.secureStore.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    stores.secureStore.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    stores.secureStore.delete(key);
  }),
}));

vi.mock("./notifications", () => ({
  unregisterDevicePushToken: () => stores.unregisterDevicePushToken(),
}));

const authUser: AuthUser = {
  id: "user-1",
  email: "test@example.com",
  displayName: "테스트 사용자",
  role: "user",
  accountType: "registered",
  emailVerifiedAt: null,
};

const dashboardSummary: DashboardSummary = {
  todayExpiryCount: 1,
  within3DaysCount: 1,
  within7DaysCount: 2,
  expiredCount: 0,
  totalActiveCount: 3,
  recentItems: [],
  expiringItems: [],
  locationCounts: {},
};

describe("mobile API client core flow", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    stores.asyncStorage.clear();
    stores.secureStore.clear();
    stores.fetch = vi.fn();
    globalThis.fetch = stores.fetch as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requires a registered session before calling an authenticated endpoint", async () => {
    const { getDashboardSummary } = await import("./api");

    await expect(getDashboardSummary()).rejects.toThrow(/로그인/);
    expect(stores.fetch).not.toHaveBeenCalled();
  });

  it("uses a restored registered session for authenticated requests", async () => {
    stores.asyncStorage.set("expirymate.authUser.v2", JSON.stringify(authUser));
    stores.secureStore.set("expirymate.refreshToken.v2", "refresh-existing");
    stores.fetch
      .mockResolvedValueOnce(successResponse(createSession("access-1", "refresh-1")))
      .mockResolvedValueOnce(successResponse(dashboardSummary));
    const { getDashboardSummary } = await import("./api");

    const result = await getDashboardSummary();

    expect(result.todayExpiryCount).toBe(1);
    expect(stores.fetch).toHaveBeenNthCalledWith(
      1,
      "http://localhost:4000/auth/refresh",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(stores.fetch).toHaveBeenNthCalledWith(
      2,
      "http://localhost:4000/dashboard/summary",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer access-1",
        }),
      }),
    );
  });

  it("refreshes the session and retries once when an authenticated request expires", async () => {
    stores.asyncStorage.set("expirymate.authUser.v2", JSON.stringify(authUser));
    stores.secureStore.set("expirymate.refreshToken.v2", "refresh-existing");
    stores.fetch
      .mockResolvedValueOnce(successResponse(createSession("access-1", "refresh-2")))
      .mockResolvedValueOnce(errorResponse(401, "만료된 세션입니다."))
      .mockResolvedValueOnce(successResponse(createSession("access-2", "refresh-3")))
      .mockResolvedValueOnce(successResponse({ ...authUser, displayName: "갱신됨" }));
    const { getMe } = await import("./api");

    const result = await getMe();

    expect(result?.displayName).toBe("갱신됨");
    expect(stores.fetch).toHaveBeenNthCalledWith(
      2,
      "http://localhost:4000/auth/me",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer access-1",
        }),
      }),
    );
    expect(stores.fetch).toHaveBeenNthCalledWith(
      4,
      "http://localhost:4000/auth/me",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer access-2",
        }),
      }),
    );
    expect(stores.secureStore.get("expirymate.refreshToken.v2")).toBe("refresh-3");
  });

  it("uses the new access token immediately after login", async () => {
    const registeredUser: AuthUser = {
      ...authUser,
      id: "user-registered",
      email: "test@example.com",
      accountType: "registered",
    };

    stores.fetch
      .mockResolvedValueOnce(
        successResponse(
          createSession("registered-access", "registered-refresh", registeredUser),
        ),
      )
      .mockResolvedValueOnce(successResponse(registeredUser));
    const { login, getMe } = await import("./api");

    await login({ email: "test@example.com", password: "password123" });
    const result = await getMe();

    expect(result?.id).toBe("user-registered");
    expect(stores.fetch).toHaveBeenNthCalledWith(
      1,
      "http://localhost:4000/auth/login",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(stores.fetch).toHaveBeenNthCalledWith(
      2,
      "http://localhost:4000/auth/me",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer registered-access",
        }),
      }),
    );
  });

  it("unregisters the push token before clearing the session on logout", async () => {
    stores.asyncStorage.set("expirymate.authUser.v2", JSON.stringify(authUser));
    stores.secureStore.set("expirymate.refreshToken.v2", "refresh-existing");
    const callOrder: string[] = [];
    stores.unregisterDevicePushToken.mockImplementation(async () => {
      callOrder.push("unregister");
      return { ok: true, skipped: false };
    });
    stores.fetch.mockImplementation(async (url: string) => {
      if (String(url).includes("/auth/logout")) {
        callOrder.push("logout");
        return successResponse({ ok: true });
      }
      if (String(url).includes("/auth/refresh")) {
        return successResponse(createSession("access-1", "refresh-1"));
      }
      return errorResponse(500, "unexpected");
    });
    const { logout } = await import("./api");

    await logout();

    expect(callOrder).toEqual(["unregister", "logout"]);
    expect(stores.asyncStorage.has("expirymate.authUser.v2")).toBe(false);
    expect(stores.secureStore.has("expirymate.refreshToken.v2")).toBe(false);
  });

  it("registers a push token through an authenticated request", async () => {
    stores.asyncStorage.set("expirymate.authUser.v2", JSON.stringify(authUser));
    stores.secureStore.set("expirymate.refreshToken.v2", "refresh-existing");
    stores.fetch
      .mockResolvedValueOnce(successResponse(createSession("access-1", "refresh-1")))
      .mockResolvedValueOnce(
        successResponse({
          id: "push-token-1",
          ownerKey: "user-1",
          token: "ExpoPushToken[token]",
          platform: "ios",
          deviceId: null,
          appVersion: "1.0.0",
          enabled: true,
          lastSeenAt: "2026-06-07T00:00:00.000Z",
          updatedAt: "2026-06-07T00:00:00.000Z",
        }),
      );
    const { registerPushToken } = await import("./api");

    await registerPushToken({
      token: "ExpoPushToken[token]",
      platform: "ios",
      appVersion: "1.0.0",
    });

    expect(stores.fetch).toHaveBeenNthCalledWith(
      2,
      "http://localhost:4000/notifications/push-tokens",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          token: "ExpoPushToken[token]",
          platform: "ios",
          appVersion: "1.0.0",
        }),
        headers: expect.objectContaining({
          Authorization: "Bearer access-1",
        }),
      }),
    );
  });
});

function createSession(
  accessToken: string,
  refreshToken: string,
  user: AuthUser = authUser,
): AuthSession {
  return {
    user,
    accessToken,
    refreshToken,
  };
}

function successResponse<T>(data: T) {
  return jsonResponse(200, {
    success: true,
    data,
  });
}

function errorResponse(status: number, message: string) {
  return jsonResponse(status, {
    success: false,
    error: {
      message,
    },
  });
}

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn(async () => body),
  } as unknown as Response;
}
