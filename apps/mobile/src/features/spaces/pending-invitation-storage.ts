import {
  isValidSpaceInvitationCode,
  normalizeSpaceInvitationCode,
} from "@expirymate/shared";

export type PendingSpaceInvitation =
  | { version: 2; kind: "email"; token: string }
  | { version: 2; kind: "code"; code: string };

export function parsePendingSpaceInvitation(
  value: string | null,
  legacy = false,
): PendingSpaceInvitation | null {
  if (!value?.trim()) {
    return null;
  }
  if (legacy) {
    return { version: 2, kind: "email", token: value.trim() };
  }
  try {
    const parsed = JSON.parse(value) as Partial<PendingSpaceInvitation>;
    if (
      parsed.version === 2 &&
      parsed.kind === "email" &&
      typeof parsed.token === "string" &&
      parsed.token.trim()
    ) {
      return { version: 2, kind: "email", token: parsed.token.trim() };
    }
    if (
      parsed.version === 2 &&
      parsed.kind === "code" &&
      typeof parsed.code === "string" &&
      isValidSpaceInvitationCode(parsed.code)
    ) {
      return {
        version: 2,
        kind: "code",
        code: normalizeSpaceInvitationCode(parsed.code),
      };
    }
  } catch {
    return null;
  }
  return null;
}
