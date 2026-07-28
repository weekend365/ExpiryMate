import type { RewardedAdSession } from "@expirymate/shared";
import { Platform } from "react-native";
import {
  cancelRewardedAdSession,
  getRewardedAdSession,
} from "../../services/api";

const POLL_INTERVAL_MS = 1_000;
const POLL_TIMEOUT_MS = 10_000;

let mobileAdsInitialization: Promise<unknown> | null = null;

export type RewardedAdResult = "verified" | "verifying";

export async function presentRewardedAd(
  session: RewardedAdSession,
): Promise<RewardedAdResult> {
  const ads = await import("react-native-google-mobile-ads");

  if (!mobileAdsInitialization) {
    mobileAdsInitialization = (async () => {
      await ads.default().setRequestConfiguration({
        maxAdContentRating: ads.MaxAdContentRating.G,
        tagForChildDirectedTreatment: false,
      });
      return ads.default().initialize();
    })();
  }
  await mobileAdsInitialization;

  const production = process.env.EXPO_PUBLIC_APP_ENV === "production";
  const configuredUnitId =
    Platform.OS === "ios"
      ? process.env.EXPO_PUBLIC_ADMOB_IOS_REWARDED_AD_UNIT_ID
      : process.env.EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_AD_UNIT_ID;
  const adUnitId = production ? configuredUnitId?.trim() : ads.TestIds.REWARDED;

  if (!adUnitId) {
    await cancelRewardedAdSession(session.id).catch(() => null);
    throw new Error("광고 설정을 확인하지 못했어요. 잠시 뒤에 다시 시도해 주세요.");
  }

  return new Promise<RewardedAdResult>((resolve, reject) => {
    let earnedReward = false;
    let settled = false;
    const removers: Array<() => void> = [];
    const ad = ads.RewardedAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: true,
      serverSideVerificationOptions: {
        userId: session.userIdentifier,
        customData: session.customData,
      },
    });

    const cleanup = () => {
      removers.forEach((remove) => remove());
    };
    const fail = async (message: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      await cancelRewardedAdSession(session.id).catch(() => null);
      reject(new Error(message));
    };

    removers.push(
      ad.addAdEventListener(ads.RewardedAdEventType.LOADED, () => {
        ad.show().catch(() => {
          void fail("광고를 열지 못했어요. 잠시 뒤에 다시 시도해 주세요.");
        });
      }),
      ad.addAdEventListener(ads.RewardedAdEventType.EARNED_REWARD, () => {
        // This client event only starts polling. The server-side callback is
        // the sole authority that grants a recommendation credit.
        earnedReward = true;
      }),
      ad.addAdEventListener(ads.AdEventType.ERROR, () => {
        void fail("지금 볼 수 있는 광고가 없어요. 잠시 뒤에 다시 시도해 주세요.");
      }),
      ad.addAdEventListener(ads.AdEventType.CLOSED, () => {
        if (!earnedReward) {
          void fail("광고를 끝까지 보면 추천 1회를 받을 수 있어요.");
          return;
        }

        void pollForServerVerification(session.id).then((verified) => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(verified ? "verified" : "verifying");
        });
      }),
    );

    ad.load();
  });
}

async function pollForServerVerification(sessionId: string) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const result = await getRewardedAdSession(sessionId);
    if (result.status === "verified") {
      return true;
    }
    if (result.status === "cancelled" || result.status === "expired") {
      return false;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  return false;
}
