import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import {
  isValidSpaceInvitationCode,
  normalizeSpaceInvitationCode,
} from "@expirymate/shared";
import { router, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { useAuth } from "../auth/use-auth";
import {
  type PendingSpaceInvitation,
  parsePendingSpaceInvitation,
} from "./pending-invitation-storage";

export {
  parsePendingSpaceInvitation,
  type PendingSpaceInvitation,
} from "./pending-invitation-storage";

const LEGACY_PENDING_INVITATION_KEY = "expirymate.pending-space-invitation";
const LEGACY_V2_PENDING_INVITATION_KEY =
  "expirymate.pending-space-invitation.v2";
const PENDING_INVITATION_KEY = "expirymate.pending-space-invitation.v3";

export async function rememberPendingEmailInvitation(token: string) {
  const trimmed = token.trim();
  if (!trimmed) {
    return;
  }
  await SecureStore.setItemAsync(
    PENDING_INVITATION_KEY,
    JSON.stringify({ version: 2, kind: "email", token: trimmed }),
  );
  await clearLegacyPendingInvitations();
}

export const rememberPendingSpaceInvitation =
  rememberPendingEmailInvitation;

export async function rememberPendingCodeInvitation(code: string) {
  const normalized = normalizeSpaceInvitationCode(code);
  if (!isValidSpaceInvitationCode(normalized)) {
    throw new Error("초대 코드 8자리를 확인해 주세요.");
  }
  await SecureStore.setItemAsync(
    PENDING_INVITATION_KEY,
    JSON.stringify({ version: 2, kind: "code", code: normalized }),
  );
  await clearLegacyPendingInvitations();
}

export async function clearPendingSpaceInvitation() {
  await Promise.all([
    SecureStore.deleteItemAsync(PENDING_INVITATION_KEY),
    AsyncStorage.removeItem(LEGACY_V2_PENDING_INVITATION_KEY),
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
  const current = await SecureStore.getItemAsync(PENDING_INVITATION_KEY);
  const parsed = parsePendingSpaceInvitation(current);
  if (parsed) {
    return parsed;
  }

  const legacyV2 = parsePendingSpaceInvitation(
    await AsyncStorage.getItem(LEGACY_V2_PENDING_INVITATION_KEY),
  );
  if (legacyV2) {
    await migratePendingInvitation(legacyV2);
    return legacyV2;
  }

  const legacyToken = await AsyncStorage.getItem(
    LEGACY_PENDING_INVITATION_KEY,
  );
  const legacyInvitation = parsePendingSpaceInvitation(legacyToken, true);
  if (legacyInvitation) {
    await migratePendingInvitation(legacyInvitation);
  }
  return legacyInvitation;
}

async function migratePendingInvitation(
  invitation: PendingSpaceInvitation,
) {
  await SecureStore.setItemAsync(
    PENDING_INVITATION_KEY,
    JSON.stringify(invitation),
  );
  await clearLegacyPendingInvitations();
}

async function clearLegacyPendingInvitations() {
  await Promise.all([
    AsyncStorage.removeItem(LEGACY_V2_PENDING_INVITATION_KEY),
    AsyncStorage.removeItem(LEGACY_PENDING_INVITATION_KEY),
  ]);
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
