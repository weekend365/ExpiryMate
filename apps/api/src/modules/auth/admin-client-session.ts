import { ForbiddenException } from "@nestjs/common";
import type { AuthUserRole } from "@expirymate/shared";

interface SessionLike {
  user: {
    role: AuthUserRole | string;
  };
  refreshToken?: string;
  accessToken: string;
}

interface AuthLogout {
  logout(refreshToken: string): Promise<unknown>;
}

/**
 * Admin SPA sends x-expirymate-client: admin. Reject non-admin roles before
 * issuing cookies/tokens so a normal user login cannot leave a live session.
 */
export async function ensureAdminClientAllowed(
  authService: AuthLogout,
  session: SessionLike,
  client: string | undefined,
  clearRefreshCookie: () => void,
) {
  if (client !== "admin") {
    return;
  }

  if (session.user.role === "admin") {
    return;
  }

  if (session.refreshToken) {
    await authService.logout(session.refreshToken);
  }

  clearRefreshCookie();
  throw new ForbiddenException(
    "관리자 권한이 필요해요. 관리자 계정으로 다시 로그인해 주세요.",
  );
}
