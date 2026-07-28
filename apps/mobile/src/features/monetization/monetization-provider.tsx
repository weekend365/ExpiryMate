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
} from "../../services/api";
import {
  sessionQueryKeys,
  withSessionUser,
} from "../auth/session-boundary";
import { useAuth } from "../auth/use-auth";
import {
  presentRewardedAd,
  type RewardedAdResult,
} from "./rewarded-ad";

type MonetizationContextValue = {
  access: RecommendationAccess | undefined;
  isLoading: boolean;
  adState: "idle" | "loading" | "verifying";
  refresh: () => Promise<RecommendationAccess | undefined>;
  watchRewardedAd: () => Promise<RewardedAdResult>;
};

const MonetizationContext = createContext<MonetizationContextValue | null>(
  null,
);

export function MonetizationProvider({ children }: PropsWithChildren) {
  const { isRegistered, sessionUserId } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = withSessionUser(sessionQueryKeys.monetization, sessionUserId);
  const [adState, setAdState] =
    useState<MonetizationContextValue["adState"]>("idle");
  const query = useQuery({
    queryKey,
    queryFn: getMonetizationStatus,
    enabled: Boolean(isRegistered && sessionUserId),
    staleTime: 15_000,
  });

  const refresh = useCallback(async () => {
    if (!isRegistered || !sessionUserId) return undefined;
    const result = await queryClient.fetchQuery({
      queryKey,
      queryFn: getMonetizationStatus,
      staleTime: 0,
    });
    return result;
  }, [isRegistered, queryClient, queryKey, sessionUserId]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refresh();
      }
    });
    return () => subscription.remove();
  }, [refresh]);

  const watchRewardedAd = useCallback(async () => {
    if (query.data?.tier === "jango_plus") {
      throw new Error("장고 플러스 이용자는 광고 없이 추천할 수 있어요.");
    }
    if (!query.data?.rewardedAds.canWatch) {
      throw new Error("오늘 받을 수 있는 광고 추천권을 모두 받았어요.");
    }

    setAdState("loading");
    try {
      const session = await createRewardedAdSession(
        Platform.OS === "ios" ? "ios" : "android",
      );
      const result = await presentRewardedAd(session);
      setAdState(result === "verified" ? "idle" : "verifying");
      await refresh();
      return result;
    } catch (error) {
      setAdState("idle");
      throw error;
    }
  }, [query.data?.rewardedAds.canWatch, query.data?.tier, refresh]);

  const value = useMemo(
    () => ({
      access: query.data,
      isLoading: query.isLoading,
      adState,
      refresh,
      watchRewardedAd,
    }),
    [adState, query.data, query.isLoading, refresh, watchRewardedAd],
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
