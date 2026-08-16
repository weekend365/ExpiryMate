export const REWARDED_AD_RUNTIME_UNAVAILABLE_MESSAGE =
  "광고는 장고 앱에서만 볼 수 있어요. Expo Go가 아니라 개발 빌드로 열어 주세요.";

export function isExpoGoClient(constants: {
  executionEnvironment?: string | null;
  appOwnership?: string | null;
}) {
  return (
    constants.executionEnvironment === "storeClient" ||
    constants.appOwnership === "expo"
  );
}

type MobileAdsFactory = () => {
  initialize: () => Promise<unknown>;
  setRequestConfiguration: (config: unknown) => Promise<unknown>;
};

export function resolveMobileAdsFactory(module: {
  MobileAds?: unknown;
  default?: unknown;
}): MobileAdsFactory | null {
  const nested =
    module.default && typeof module.default === "object"
      ? (module.default as { MobileAds?: unknown; default?: unknown })
      : undefined;

  const candidates = [
    module.MobileAds,
    module.default,
    nested?.MobileAds,
    nested?.default,
  ];

  const factory = candidates.find((value) => typeof value === "function");
  return typeof factory === "function" ? (factory as MobileAdsFactory) : null;
}
