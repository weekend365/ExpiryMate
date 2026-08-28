import type { InventoryPhotoParseAccess } from "@expirymate/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppState, Platform } from "react-native";
import {
  createRewardedAdSession,
  getInventoryPhotoParseAccess,
  getRewardedAdSession,
  trackMonetizationEvent,
} from "../../services/api";
import {
  sessionQueryKeys,
  withInventorySpace,
} from "../auth/session-boundary";
import { useAuth } from "../auth/use-auth";
import {
  clearPendingRewardedAdSession,
  getPendingRewardedAdSession,
  resolvePendingRewardedAdSession,
  savePendingRewardedAdSession,
} from "../monetization/pending-rewarded-ad";
import {
  presentRewardedAd,
  type RewardedAdResult,
} from "../monetization/rewarded-ad";
import { useActiveSpace } from "../spaces/space-provider";

const PURPOSE = "inventory_photo_parse" as const;

export type PhotoParseAdState = "idle" | "loading" | "verifying";

export function usePhotoParseAccess() {
  const { isRegistered, sessionUserId } = useAuth();
  const { activeSpaceId, isReady: isSpaceReady } = useActiveSpace();
  const queryClient = useQueryClient();
  const [adState, setAdState] = useState<PhotoParseAdState>("idle");
  const queryKey = useMemo(
    () =>
      withInventorySpace(
        sessionQueryKeys.photoParseAccess,
        sessionUserId,
        activeSpaceId,
      ),
    [activeSpaceId, sessionUserId],
  );
  const query = useQuery({
    queryKey,
    queryFn: () => getInventoryPhotoParseAccess(activeSpaceId!),
    enabled: Boolean(
      isRegistered && sessionUserId && activeSpaceId && isSpaceReady,
    ),
    staleTime: 5_000,
  });

  const refresh = useCallback(async () => {
    if (!isRegistered || !sessionUserId || !activeSpaceId) return undefined;
    return queryClient.fetchQuery({
      queryKey,
      queryFn: () => getInventoryPhotoParseAccess(activeSpaceId),
      staleTime: 0,
    });
  }, [activeSpaceId, isRegistered, queryClient, queryKey, sessionUserId]);

  const reconcilePendingReward = useCallback(async () => {
    if (!sessionUserId) {
      setAdState("idle");
      return;
    }
    const pendingId = await getPendingRewardedAdSession(
      sessionUserId,
      PURPOSE,
    ).catch(() => null);
    if (!pendingId) {
      setAdState("idle");
      return;
    }
    try {
      const session = await getRewardedAdSession(pendingId);
      const resolution = resolvePendingRewardedAdSession(session.status);
      if (resolution.clearPending) {
        await clearPendingRewardedAdSession(
          sessionUserId,
          pendingId,
          PURPOSE,
        ).catch(() => undefined);
      }
      if (resolution.rewardVerified) await refresh();
      setAdState(session.status === "pending" ? "verifying" : "idle");
    } catch {
      setAdState("verifying");
    }
  }, [refresh, sessionUserId]);

  useEffect(() => {
    void reconcilePendingReward();
  }, [reconcilePendingReward]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refresh();
        void reconcilePendingReward();
      }
    });
    return () => subscription.remove();
  }, [reconcilePendingReward, refresh]);

  useEffect(() => {
    if (adState !== "verifying") return;
    const timer = setInterval(() => {
      void reconcilePendingReward();
    }, 8_000);
    return () => clearInterval(timer);
  }, [adState, reconcilePendingReward]);

  const watchRewardedAd = useCallback(async (): Promise<RewardedAdResult> => {
    if (!sessionUserId || !activeSpaceId) {
      throw new Error("로그인과 저장공간을 확인한 뒤 다시 시도해 주세요.");
    }
    if (!query.data?.rewardedAds.canWatch) {
      throw new Error("지금은 사진 분석 광고를 시청할 수 없어요.");
    }

    setAdState("loading");
    try {
      const session = await createRewardedAdSession(
        Platform.OS === "ios" ? "ios" : "android",
        activeSpaceId,
        PURPOSE,
      );
      await savePendingRewardedAdSession(
        sessionUserId,
        session.id,
        PURPOSE,
      );
      const result = await presentRewardedAd(session);
      if (result === "verified") {
        await clearPendingRewardedAdSession(
          sessionUserId,
          session.id,
          PURPOSE,
        ).catch(() => undefined);
        setAdState("idle");
      } else {
        setAdState("verifying");
      }
      void trackMonetizationEvent({
        event:
          result === "verified"
            ? "rewarded_ad_verified"
            : "rewarded_ad_verifying",
        properties: { purpose: PURPOSE, session_id: session.id },
      }).catch(() => undefined);
      await refresh().catch(() => undefined);
      return result;
    } catch (error) {
      setAdState("idle");
      await clearPendingRewardedAdSession(
        sessionUserId,
        undefined,
        PURPOSE,
      ).catch(() => undefined);
      void trackMonetizationEvent({
        event: "rewarded_ad_failed",
        properties: { purpose: PURPOSE },
      }).catch(() => undefined);
      throw error;
    }
  }, [activeSpaceId, query.data?.rewardedAds.canWatch, refresh, sessionUserId]);

  return {
    access: query.data as InventoryPhotoParseAccess | undefined,
    isLoading: query.isLoading,
    isError: query.isError,
    adState,
    refresh,
    watchRewardedAd,
  };
}
