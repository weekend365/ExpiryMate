import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { useAuth } from "../auth/use-auth";

const PENDING_INVITATION_KEY = "expirymate.pending-space-invitation";

export function rememberPendingSpaceInvitation(token: string) {
  return AsyncStorage.setItem(PENDING_INVITATION_KEY, token);
}

export function clearPendingSpaceInvitation() {
  return AsyncStorage.removeItem(PENDING_INVITATION_KEY);
}

export async function continuePendingSpaceInvitation() {
  const token = await AsyncStorage.getItem(PENDING_INVITATION_KEY);
  if (!token) {
    return false;
  }
  router.replace({
    pathname: "/spaces/invitations/accept",
    params: { token },
  });
  return true;
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
