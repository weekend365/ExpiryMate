import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import { assertSamePixels, assertTransparentPadding, deriveMaster, expectedMaster, readManifest } from "./sync-mascot-sources.mjs";

describe("mascot v2 source pipeline", () => {
  it("keeps all reviewed source files reproducible", () => {
    for (const entry of readManifest().poses) {
      const output = expectedMaster(entry);
      expect(output.width).toBe(1024);
      expect(output.height).toBe(1024);
    }
  }, 20000);

  it("rejects stretched input instead of normalizing away distortion", () => {
    const entry = readManifest().poses[0];
    const warped = new PNG({ width: 600, height: 700 });
    expect(() => deriveMaster(warped, entry)).toThrow("aspect ratio");
  });

  it("rejects clipping anywhere on an edge, not just the corners", () => {
    const png = new PNG({ width: 8, height: 8 });
    png.alpha = true;
    png.data[(4 * 8 + 4) * 4 + 3] = 255;
    expect(() => assertTransparentPadding(png, "valid")).not.toThrow();
    png.data[(4 * 8) * 4 + 3] = 255;
    expect(() => assertTransparentPadding(png, "clipped")).toThrow("canvas edge");
  });

  it("rejects a stale derivative and same-size pixel distortion", () => {
    const original = new PNG({ width: 8, height: 8 });
    const changed = new PNG({ width: 8, height: 8 });
    changed.data[100] = 127;
    expect(() => assertSamePixels(changed, original, "old runtime")).toThrow("stale");
    expect(() => assertSamePixels(new PNG({ width: 7, height: 8 }), original, "warped")).toThrow("distorted");
  });
});
