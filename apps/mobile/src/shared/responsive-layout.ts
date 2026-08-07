import { useWindowDimensions } from "react-native";
import {
  getResponsiveFlags,
  getWindowSizeClass,
} from "./responsive-layout-core";

export * from "./responsive-layout-core";

export function useResponsiveLayout() {
  const { width, height, fontScale } = useWindowDimensions();
  const sizeClass = getWindowSizeClass(width);
  const responsiveFlags = getResponsiveFlags(width, fontScale);

  return {
    width,
    height,
    fontScale,
    sizeClass,
    isRegular: sizeClass === "regular",
    isCompact: sizeClass === "compact",
    ...responsiveFlags,
  } as const;
}
