import { describe, expect, it } from "vitest";
import {
  SCAN_FRAME_HEIGHT,
  SCAN_FRAME_HEIGHT_COMPACT,
  SCAN_FRAME_HEIGHT_MAX,
  getScanFrameHeight,
  getScanLineTravel,
} from "./scanGuide";

describe("scan guide frame height", () => {
  it("keeps the compact baseline on small phones", () => {
    expect(getScanFrameHeight(667)).toBe(SCAN_FRAME_HEIGHT);
    expect(getScanFrameHeight(390)).toBe(SCAN_FRAME_HEIGHT);
  });

  it("grows with taller windows and caps on very tall displays", () => {
    const proHeight = getScanFrameHeight(874);
    expect(proHeight).toBeGreaterThan(SCAN_FRAME_HEIGHT);
    expect(proHeight).toBeLessThanOrEqual(SCAN_FRAME_HEIGHT_MAX);
    expect(getScanFrameHeight(1400)).toBe(SCAN_FRAME_HEIGHT_MAX);
  });

  it("uses a shorter cutout for phone-landscape camera layouts", () => {
    expect(getScanFrameHeight(390, true)).toBe(SCAN_FRAME_HEIGHT_COMPACT);
    expect(SCAN_FRAME_HEIGHT_COMPACT).toBeLessThan(SCAN_FRAME_HEIGHT);
  });

  it("keeps scan-line travel inside the frame", () => {
    const frameHeight = getScanFrameHeight(874);
    expect(getScanLineTravel(frameHeight)).toBeLessThan(frameHeight);
    expect(getScanLineTravel(frameHeight)).toBeGreaterThan(0);
  });
});
