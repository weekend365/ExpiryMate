import { useWindowDimensions } from "react-native";
import { getWindowSizeClass } from "./responsive-layout-core";

export * from "./responsive-layout-core";

export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();
  const sizeClass = getWindowSizeClass(width);

  return {
    width,
    height,
    sizeClass,
    isRegular: sizeClass === "regular",
  } as const;
}
