import { describe, expect, it } from "vitest";
import {
  COMFORTABLE_TEXT_MIN_FONT_SCALE,
  LARGE_TEXT_MIN_FONT_SCALE,
  NARROW_WINDOW_MAX_WIDTH,
  REGULAR_WINDOW_MIN_WIDTH,
  SHORT_WINDOW_MAX_HEIGHT,
  contentMaxWidths,
  getBottomInsetPadding,
  getContentMaxWidth,
  getResponsiveFlags,
  getTabBarContentMinHeight,
  getTabBarMetrics,
  getTextDensity,
  getWindowSizeClass,
  TAB_BAR_PADDING_TOP,
} from "./responsive-layout-core";

describe("responsive layout", () => {
  it("switches to the regular size class at 700pt", () => {
    expect(getWindowSizeClass(REGULAR_WINDOW_MIN_WIDTH - 1)).toBe("compact");
    expect(getWindowSizeClass(REGULAR_WINDOW_MIN_WIDTH)).toBe("regular");
  });

  it("keeps compact layouts fluid", () => {
    expect(getContentMaxWidth("form", 699)).toBeUndefined();
    expect(getContentMaxWidth("wide", 699)).toBeUndefined();
  });

  it("resolves regular content width presets", () => {
    expect(getContentMaxWidth("form", 700)).toBe(contentMaxWidths.form);
    expect(getContentMaxWidth("content", 834)).toBe(contentMaxWidths.content);
    expect(getContentMaxWidth("wide", 1366)).toBe(contentMaxWidths.wide);
  });

  it("keeps fluid content unconstrained at every width", () => {
    expect(getContentMaxWidth("fluid", 699)).toBeUndefined();
    expect(getContentMaxWidth("fluid", 1366)).toBeUndefined();
  });

  it("classifies text density bands for system font scale", () => {
    expect(getTextDensity(1)).toBe("regular");
    expect(getTextDensity(COMFORTABLE_TEXT_MIN_FONT_SCALE)).toBe("comfortable");
    expect(getTextDensity(LARGE_TEXT_MIN_FONT_SCALE)).toBe("large");
  });

  it("stacks content for narrow windows and large system text", () => {
    expect(
      getResponsiveFlags(NARROW_WINDOW_MAX_WIDTH - 1, 1),
    ).toMatchObject({
      isNarrow: true,
      isLargeText: false,
      shouldStack: true,
      shouldStackDense: true,
      textDensity: "regular",
    });
    expect(
      getResponsiveFlags(412, LARGE_TEXT_MIN_FONT_SCALE),
    ).toMatchObject({
      isNarrow: false,
      isLargeText: true,
      shouldStack: true,
      shouldStackDense: true,
      textDensity: "large",
    });
    expect(getResponsiveFlags(412, 1)).toMatchObject({
      isNarrow: false,
      isLargeText: false,
      shouldStack: false,
      shouldStackDense: false,
      textDensity: "regular",
    });
  });

  it("stacks dense rows from mid-range font scale without full large-text mode", () => {
    expect(
      getResponsiveFlags(412, COMFORTABLE_TEXT_MIN_FONT_SCALE),
    ).toMatchObject({
      isLargeText: false,
      isComfortableText: true,
      shouldStack: false,
      shouldStackDense: true,
      textDensity: "comfortable",
    });
  });

  it("treats Android display-size narrow widths up to 400pt as stackable", () => {
    expect(NARROW_WINDOW_MAX_WIDTH).toBe(400);
    expect(getResponsiveFlags(399, 1).isNarrow).toBe(true);
    expect(getResponsiveFlags(400, 1).isNarrow).toBe(false);
  });

  it("detects short phone-landscape windows without forcing vertical stacking", () => {
    expect(
      getResponsiveFlags(844, 1, SHORT_WINDOW_MAX_HEIGHT - 1),
    ).toMatchObject({
      isLandscape: true,
      isShort: true,
      isPhoneLandscape: true,
      shouldStack: false,
    });
    expect(getResponsiveFlags(800, 1, 600)).toMatchObject({
      isLandscape: true,
      isShort: false,
      isPhoneLandscape: false,
    });
  });

  it("grows tab bar content when large-text labels remain visible", () => {
    expect(getTabBarContentMinHeight(false)).toBe(56);
    expect(getTabBarContentMinHeight(true)).toBe(64);
  });

  it("reserves system bottom inset below tab content so bars do not overlap", () => {
    const withNavBar = getTabBarMetrics(false, 48);
    expect(withNavBar.contentMinHeight).toBe(56);
    expect(withNavBar.paddingTop).toBe(TAB_BAR_PADDING_TOP);
    expect(withNavBar.paddingBottom).toBe(48);
    expect(withNavBar.height).toBe(56 + TAB_BAR_PADDING_TOP + 48);

    const gestureOnly = getTabBarMetrics(true, 16);
    expect(gestureOnly.height).toBe(64 + TAB_BAR_PADDING_TOP + 16);
    expect(getTabBarMetrics(false, -1).paddingBottom).toBe(0);
  });

  it("applies bottom insets only when the screen owns the system edge", () => {
    expect(getBottomInsetPadding("system", 34, 16)).toBe(34);
    expect(getBottomInsetPadding("system", 8, 16)).toBe(16);
    expect(getBottomInsetPadding("navigator", 34, 16)).toBe(16);
    expect(getBottomInsetPadding("none", 34, 0)).toBe(0);
  });
});
