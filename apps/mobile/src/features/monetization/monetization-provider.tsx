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

    setAdState("verifying");
    try {
      const session = await getRewardedAdSession(pendingSessionId);
      if (session.status === "pending") return;

      await clearPendingRewardedAdSession(
        sessionUserId,
        pendingSessionId,
      ).catch(() => undefined);
      setAdState("idle");
      if (session.status === "verified") {
        setRewardNotice("verified");
        void trackMonetizationEvent({
          event: "rewarded_ad_verified",
          properties: { resolution: "app_resume" },
        }).catch(() => undefined);
      }
      await refresh();
    } catch {
      // Keep the session id and retry when the app becomes active again.
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
      }
    });
    return () => subscription.remove();
  }, [reconcilePendingReward, refresh]);

  const watchRewardedAd = useCallback(async () => {
    if (!sessionUserId) {
      throw new Error("로그인 상태를 확인한 뒤 다시 시도해 주세요.");
    }
    if (query.data?.tier !== "free") {
      throw new Error("장고 플러스 이용자는 광고 없이 추천할 수 있어요.");
    }
    if (!query.data?.rewardedAds.canWatch) {
      throw new Error("오늘 받을 수 있는 광고 추천권을 모두 받았어요.");
    }

    setAdState("loading");
    try {
      void trackMonetizationEvent({ event: "rewarded_ad_requested" }).catch(
        () => undefined,
      );
      const session = await createRewardedAdSession(
        Platform.OS === "ios" ? "ios" : "android",
        activeSpaceId,
      );
      await savePendingRewardedAdSession(sessionUserId, session.id);
      const result = await presentRewardedAd(session, (event) => {
        trackRewardedAdLifecycleEvent(event, session.id);
      });
      setAdState(result === "verified" ? "idle" : "verifying");
      if (result === "verified") {
        await clearPendingRewardedAdSession(
          sessionUserId,
          session.id,
        ).catch(() => undefined);
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
    query.data?.tier,
    activeSpaceId,
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
