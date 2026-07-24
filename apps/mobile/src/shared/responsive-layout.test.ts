import { describe, expect, it } from "vitest";
import {
  REGULAR_WINDOW_MIN_WIDTH,
  contentMaxWidths,
  getContentMaxWidth,
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
});
