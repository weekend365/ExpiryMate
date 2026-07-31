import { describe, expect, it } from "vitest";
import {
  LARGE_TEXT_MIN_FONT_SCALE,
  NARROW_WINDOW_MAX_WIDTH,
  REGULAR_WINDOW_MIN_WIDTH,
  contentMaxWidths,
  getBottomInsetPadding,
  getContentMaxWidth,
  getResponsiveFlags,
  getWindowSizeClass,
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

  it("stacks content for narrow windows and large system text", () => {
    expect(
      getResponsiveFlags(NARROW_WINDOW_MAX_WIDTH - 1, 1),
    ).toMatchObject({
      isNarrow: true,
      isLargeText: false,
      shouldStack: true,
    });
    expect(
      getResponsiveFlags(412, LARGE_TEXT_MIN_FONT_SCALE),
    ).toMatchObject({
      isNarrow: false,
      isLargeText: true,
      shouldStack: true,
    });
    expect(getResponsiveFlags(412, 1)).toMatchObject({
      isNarrow: false,
      isLargeText: false,
      shouldStack: false,
    });
  });

  it("applies bottom insets only when the screen owns the system edge", () => {
    expect(getBottomInsetPadding("system", 34, 16)).toBe(34);
    expect(getBottomInsetPadding("system", 8, 16)).toBe(16);
    expect(getBottomInsetPadding("navigator", 34, 16)).toBe(16);
    expect(getBottomInsetPadding("none", 34, 0)).toBe(0);
  });
});
