import type { RecommendationAccess } from "@expirymate/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppState, Platform } from "react-native";
import {
  ApiError,
  cancelRewardedAdSession,
  createRewardedAdSession,
  getMonetizationStatus,
  getRewardedAdSession,
  trackMonetizationEvent,
} from "../../services/api";
import {
  sessionQueryKeys,
  withSessionUser,
} from "../auth/session-boundary";
import { useAuth } from "../auth/use-auth";
import { useActiveSpace } from "../spaces/space-provider";
import {
  clearPendingRewardedAdSession,
  getPendingRewardedAdSession,
  resolvePendingRewardedAdSession,
  savePendingRewardedAdSession,
} from "./pending-rewarded-ad";
import {
  presentRewardedAd,
  type RewardedAdLifecycleEvent,
  type RewardedAdResult,
} from "./rewarded-ad";

type MonetizationContextValue = {
  access: RecommendationAccess | undefined;
  isLoading: boolean;
  adState: "idle" | "loading" | "verifying";
  rewardNotice: "verified" | null;
  dismissRewardNotice: () => void;
  refresh: () => Promise<RecommendationAccess | undefined>;
  watchRewardedAd: () => Promise<RewardedAdResult>;
};

const MonetizationContext = createContext<MonetizationContextValue | null>(
  null,
);

export function MonetizationProvider({ children }: PropsWithChildren) {
  const { isRegistered, sessionUserId } = useAuth();
  const { activeSpaceId, isReady: isSpaceReady } = useActiveSpace();
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () =>
      [
        ...withSessionUser(sessionQueryKeys.monetization, sessionUserId),
        activeSpaceId ?? "no-space",
      ] as const,
    [activeSpaceId, sessionUserId],
  );
  const [adState, setAdState] =
    useState<MonetizationContextValue["adState"]>("idle");
  const [rewardNotice, setRewardNotice] =
    useState<MonetizationContextValue["rewardNotice"]>(null);
  const query = useQuery({
    queryKey,
    queryFn: () => getMonetizationStatus(activeSpaceId),
    enabled: Boolean(isRegistered && sessionUserId && activeSpaceId && isSpaceReady),
    staleTime: 15_000,
  });

  const refresh = useCallback(async () => {
    if (!isRegistered || !sessionUserId || !activeSpaceId) return undefined;
    const result = await queryClient.fetchQuery({
      queryKey,
      queryFn: () => getMonetizationStatus(activeSpaceId),
      staleTime: 0,
    });
    return result;
  }, [activeSpaceId, isRegistered, queryClient, queryKey, sessionUserId]);

  const reconcilePendingReward = useCallback(async () => {
    if (!isRegistered || !sessionUserId) {
      setAdState("idle");
      return;
    }

    const pendingSessionId =
      await getPendingRewardedAdSession(sessionUserId).catch(() => null);
    if (!pendingSessionId) {
      setAdState("idle");
      return;
    }

    try {
      const session = await getRewardedAdSession(pendingSessionId);
      const resolution = resolvePendingRewardedAdSession(session.status);
      if (resolution.clearPending) {
        await clearPendingRewardedAdSession(
          sessionUserId,
          pendingSessionId,
        ).catch(() => undefined);
      }
      if (resolution.rewardVerified) {
        setRewardNotice("verified");
        void trackMonetizationEvent({
          event: "rewarded_ad_verified",
          properties: { resolution: "app_resume" },
        }).catch(() => undefined);
        await refresh();
      }
      setAdState("idle");
    } catch {
      // Keep the session id and retry when the app becomes active again.
      // Do not freeze the watch CTA on a network blip.
      setAdState("idle");
    }
  }, [isRegistered, refresh, sessionUserId]);

  useEffect(() => {
    void reconcilePendingReward();
  }, [reconcilePendingReward]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refresh();
        void reconcilePendingReward();
        // Pick up server-side entitlement resync / ASSN updates without opening Settings.
        void queryClient
          .invalidateQueries({
            queryKey: withSessionUser(
              sessionQueryKeys.subscription,
              sessionUserId,
            ),
          })
          .catch(() => undefined);
      }
    });
    return () => subscription.remove();
  }, [queryClient, reconcilePendingReward, refresh, sessionUserId]);

  const watchRewardedAd = useCallback(async () => {
    if (!sessionUserId) {
      throw new Error("로그인 상태를 확인한 뒤 다시 시도해 주세요.");
    }
    if (query.data?.tier !== "free") {
      throw new Error("장고 플러스 이용자는 광고 없이 추천할 수 있어요.");
    }
    if (!query.data?.rewardedAdsEnabled) {
      throw new Error("지금은 광고로 추천권을 받을 수 없어요.");
    }
    if (
      !query.data.rewardedAds.canWatch &&
      query.data.rewardedAds.remainingToWatch <= 0
    ) {
      throw new Error("오늘 받을 수 있는 광고 추천권을 모두 받았어요.");
    }

    setAdState("loading");
    try {
      void trackMonetizationEvent({ event: "rewarded_ad_requested" }).catch(
        () => undefined,
      );
      const session = await createRewardedAdSessionReplacingStuck(
        Platform.OS === "ios" ? "ios" : "android",
        sessionUserId,
        activeSpaceId,
      );
      await savePendingRewardedAdSession(sessionUserId, session.id);
      const result = await presentRewardedAd(session, (event) => {
        trackRewardedAdLifecycleEvent(event, session.id);
      });
      if (result === "verified") {
        setAdState("idle");
        await clearPendingRewardedAdSession(
          sessionUserId,
          session.id,
        ).catch(() => undefined);
      } else {
        // SSV can arrive after the client poll. Keep a notice, but do not
        // lock the remaining-ad entry point while waiting.
        setAdState("verifying");
        setTimeout(() => {
          void reconcilePendingReward();
        }, 8_000);
      }
      void trackMonetizationEvent({
        event:
          result === "verified"
            ? "rewarded_ad_verified"
            : "rewarded_ad_verifying",
        properties: { session_id: session.id },
      }).catch(() => undefined);
      await refresh().catch(() => undefined);
      return result;
    } catch (error) {
      setAdState("idle");
      await clearPendingRewardedAdSession(sessionUserId).catch(() => undefined);
      void trackMonetizationEvent({
        event: "rewarded_ad_failed",
        properties: {
          reason: error instanceof Error ? error.name : "unknown",
        },
      }).catch(() => undefined);
      throw error;
    }
  }, [
    query.data?.rewardedAds.canWatch,
    query.data?.rewardedAds.remainingToWatch,
    query.data?.rewardedAdsEnabled,
    query.data?.tier,
    activeSpaceId,
    reconcilePendingReward,
    refresh,
    sessionUserId,
  ]);

  const dismissRewardNotice = useCallback(() => setRewardNotice(null), []);

  const value = useMemo(
    () => ({
      access: query.data,
      isLoading: query.isLoading,
      adState,
      rewardNotice,
      dismissRewardNotice,
      refresh,
      watchRewardedAd,
    }),
    [
      adState,
      dismissRewardNotice,
      query.data,
      query.isLoading,
      refresh,
      rewardNotice,
      watchRewardedAd,
    ],
  );

  return (
    <MonetizationContext.Provider value={value}>
      {children}
    </MonetizationContext.Provider>
  );
}

export function useMonetization() {
  const value = useContext(MonetizationContext);
  if (!value) {
    throw new Error("useMonetization must be used within MonetizationProvider");
  }
  return value;
}

async function createRewardedAdSessionReplacingStuck(
  platform: "ios" | "android",
  sessionUserId: string,
  spaceId?: string,
) {
  try {
    return await createRewardedAdSession(platform, spaceId);
  } catch (error) {
    if (!(error instanceof ApiError) || error.code !== "REWARDED_AD_NOT_AVAILABLE") {
      throw error;
    }
    const pendingId = await getPendingRewardedAdSession(sessionUserId).catch(
      () => null,
    );
    if (!pendingId) {
      throw error;
    }
    await cancelRewardedAdSession(pendingId).catch(() => undefined);
    await clearPendingRewardedAdSession(sessionUserId, pendingId).catch(
      () => undefined,
    );
    return createRewardedAdSession(platform, spaceId);
  }
}

function trackRewardedAdLifecycleEvent(
  event: RewardedAdLifecycleEvent,
  sessionId: string,
) {
  const eventNames = {
    loaded: "rewarded_ad_loaded",
    opened: "rewarded_ad_opened",
    earned: "rewarded_ad_earned",
  } as const;
  void trackMonetizationEvent({
    event: eventNames[event],
    properties: { session_id: sessionId },
  }).catch(() => undefined);
}
