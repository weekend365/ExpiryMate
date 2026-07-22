import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { ensureAdminClientAllowed } from "./admin-client-session";

describe("ensureAdminClientAllowed", () => {
  it("allows non-admin clients unchanged", async () => {
    const authService = { logout: vi.fn() };
    const clearRefreshCookie = vi.fn();

    await expect(
      ensureAdminClientAllowed(
        authService,
        {
          user: { role: "user" },
          accessToken: "access",
          refreshToken: "refresh",
        },
        "mobile",
        clearRefreshCookie,
      ),
    ).resolves.toBeUndefined();

    expect(authService.logout).not.toHaveBeenCalled();
    expect(clearRefreshCookie).not.toHaveBeenCalled();
  });

  it("allows admin role for the admin client", async () => {
    const authService = { logout: vi.fn() };

    await expect(
      ensureAdminClientAllowed(
        authService,
        {
          user: { role: "admin" },
          accessToken: "access",
          refreshToken: "refresh",
        },
        "admin",
        vi.fn(),
      ),
    ).resolves.toBeUndefined();
  });

  it("rejects non-admin roles for the admin client and revokes the session", async () => {
    const authService = { logout: vi.fn().mockResolvedValue(undefined) };
    const clearRefreshCookie = vi.fn();

    await expect(
      ensureAdminClientAllowed(
        authService,
        {
          user: { role: "user" },
          accessToken: "access",
          refreshToken: "refresh",
        },
        "admin",
        clearRefreshCookie,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(authService.logout).toHaveBeenCalledWith("refresh");
    expect(clearRefreshCookie).toHaveBeenCalledOnce();
  });
});
