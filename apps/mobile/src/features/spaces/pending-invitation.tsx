import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  isValidSpaceInvitationCode,
  normalizeSpaceInvitationCode,
} from "@expirymate/shared";
import { router, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { useAuth } from "../auth/use-auth";
import {
  parsePendingSpaceInvitation,
} from "./pending-invitation-storage";

export {
  parsePendingSpaceInvitation,
  type PendingSpaceInvitation,
} from "./pending-invitation-storage";

const LEGACY_PENDING_INVITATION_KEY = "expirymate.pending-space-invitation";
const PENDING_INVITATION_KEY = "expirymate.pending-space-invitation.v2";

export async function rememberPendingEmailInvitation(token: string) {
  const trimmed = token.trim();
  if (!trimmed) {
    return;
  }
  await AsyncStorage.setItem(
    PENDING_INVITATION_KEY,
    JSON.stringify({ version: 2, kind: "email", token: trimmed }),
  );
  await AsyncStorage.removeItem(LEGACY_PENDING_INVITATION_KEY);
}

export const rememberPendingSpaceInvitation =
  rememberPendingEmailInvitation;

export async function rememberPendingCodeInvitation(code: string) {
  const normalized = normalizeSpaceInvitationCode(code);
  if (!isValidSpaceInvitationCode(normalized)) {
    throw new Error("초대 코드 8자리를 확인해 주세요.");
  }
  await AsyncStorage.setItem(
    PENDING_INVITATION_KEY,
    JSON.stringify({ version: 2, kind: "code", code: normalized }),
  );
  await AsyncStorage.removeItem(LEGACY_PENDING_INVITATION_KEY);
}

export async function clearPendingSpaceInvitation() {
  await Promise.all([
    AsyncStorage.removeItem(PENDING_INVITATION_KEY),
    AsyncStorage.removeItem(LEGACY_PENDING_INVITATION_KEY),
  ]);
}

export async function continuePendingSpaceInvitation() {
  const invitation = await readPendingSpaceInvitation();
  if (!invitation) {
    return false;
  }
  if (invitation.kind === "code") {
    router.replace({
      pathname: "/spaces/invitations/code",
      params: { code: invitation.code },
    });
  } else {
    router.replace({
      pathname: "/spaces/invitations/accept",
      params: { token: invitation.token },
    });
  }
  return true;
}

export async function readPendingSpaceInvitation() {
  const current = await AsyncStorage.getItem(PENDING_INVITATION_KEY);
  const parsed = parsePendingSpaceInvitation(current);
  if (parsed) {
    return parsed;
  }

  const legacyToken = await AsyncStorage.getItem(
    LEGACY_PENDING_INVITATION_KEY,
  );
  return parsePendingSpaceInvitation(legacyToken, true);
}

export function PendingSpaceInvitationBridge() {
  const router = useRouter();
  const { sessionUserId } = useAuth();
  const handledUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!sessionUserId || handledUserRef.current === sessionUserId) {
      return;
    }
    handledUserRef.current = sessionUserId;
    continuePendingSpaceInvitation()
      .catch(() => null);
  }, [router, sessionUserId]);

  return null;
}
