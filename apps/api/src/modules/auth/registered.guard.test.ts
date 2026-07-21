import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { AccountType, UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthGuard } from "./auth.guard";
import { RegisteredGuard } from "./registered.guard";
import type { AuthenticatedRequest } from "./auth.types";

describe("RegisteredGuard", () => {
  let authGuard: { canActivate: ReturnType<typeof vi.fn> };
  let guard: RegisteredGuard;
  let request: AuthenticatedRequest;

  beforeEach(() => {
    request = {
      headers: {},
      user: undefined,
    };
    authGuard = {
      canActivate: vi.fn(async () => {
        request.user = {
          userId: "user_registered",
          ownerKey: "user_registered",
          role: UserRole.user,
          accountType: AccountType.registered,
          tokenKind: "access",
        };
        return true;
      }),
    };
    guard = new RegisteredGuard(authGuard as unknown as AuthGuard);
  });

  it("allows registered accounts", async () => {
    await expect(
      guard.canActivate(makeContext(request)),
    ).resolves.toBe(true);
  });

  it("rejects anonymous accounts even when AuthGuard would pass", async () => {
    authGuard.canActivate.mockImplementation(async () => {
      request.user = {
        userId: "anon_abc",
        ownerKey: "anon_abc",
        role: UserRole.user,
        accountType: AccountType.anonymous,
        tokenKind: "access",
      };
      return true;
    });

    await expect(guard.canActivate(makeContext(request))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("propagates AuthGuard failures", async () => {
    authGuard.canActivate.mockRejectedValue(
      new UnauthorizedException("로그인이 필요합니다."),
    );

    await expect(guard.canActivate(makeContext(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

function makeContext(request: AuthenticatedRequest) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as never;
}
