import { requireOptionalNativeModule } from "expo";
import Constants from "expo-constants";
import { canUseIapRuntime } from "./iap-runtime-policy";

const IAP_NATIVE_MODULE_NAMES = [
  "ExpoIap",
  "ExpoIapOnside",
  "ExpoIapVega",
] as const;

/**
 * expo-iap is not included in Expo Go and can also be absent from an older
 * development client. Check before mounting useIAP so its async cleanup never
 * touches a missing native module.
 */
export function isIapRuntimeAvailable() {
  const hasNativeModule = IAP_NATIVE_MODULE_NAMES.some(
    (name) => requireOptionalNativeModule(name) !== null,
  );

  return canUseIapRuntime(Constants, hasNativeModule);
}
