import { useFonts } from "expo-font";

/**
 * Pretendard static faces used by the mobile typography ramp.
 * Family names must match the keys passed to `useFonts` / `expo-font` plugin.
 */
export const pretendardFonts = {
  "Pretendard-Regular": require("../../assets/fonts/Pretendard-Regular.otf"),
  "Pretendard-Medium": require("../../assets/fonts/Pretendard-Medium.otf"),
  "Pretendard-SemiBold": require("../../assets/fonts/Pretendard-SemiBold.otf"),
  "Pretendard-Bold": require("../../assets/fonts/Pretendard-Bold.otf"),
  "Pretendard-ExtraBold": require("../../assets/fonts/Pretendard-ExtraBold.otf"),
} as const;

/** RN fontFamily names keyed by design weight. */
export const fontFamily = {
  regular: "Pretendard-Regular",
  medium: "Pretendard-Medium",
  semibold: "Pretendard-SemiBold",
  bold: "Pretendard-Bold",
  black: "Pretendard-ExtraBold",
} as const;

export type AppFontFamily = (typeof fontFamily)[keyof typeof fontFamily];

const weightToFontFamily: Record<string, AppFontFamily> = {
  "400": fontFamily.regular,
  "500": fontFamily.medium,
  "600": fontFamily.semibold,
  "700": fontFamily.bold,
  "800": fontFamily.black,
};

/** Map a shared `fontWeight` token string to the matching Pretendard face. */
export function fontFamilyForWeight(weight: string): AppFontFamily {
  return weightToFontFamily[weight] ?? fontFamily.regular;
}

export function usePretendardFonts() {
  return useFonts(pretendardFonts);
}
