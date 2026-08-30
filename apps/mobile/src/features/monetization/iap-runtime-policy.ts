import { isExpoGoClient } from "./rewarded-ad-runtime";

export function canUseIapRuntime(
  constants: {
    executionEnvironment?: string | null;
    appOwnership?: string | null;
  },
  hasNativeModule: boolean,
) {
  return !isExpoGoClient(constants) && hasNativeModule;
}

