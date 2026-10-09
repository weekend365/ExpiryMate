import { describe, expect, it } from "vitest";
import { getCrayonCardGeometry } from "./crayon-card-geometry";

describe("crayon card geometry", () => {
  it("waits for a usable measurement instead of creating invalid SVG coordinates", () => {
    for (const [w, h] of [[0, 128], [312, 0], [-1, 128], [NaN, 128], [312, Infinity], [20, 20]]) {
      expect(getCrayonCardGeometry(w, h)).toBeNull();
    }
  });

  it("keeps one closed, deterministic outline within compact and expanded card bounds", () => {
    for (const [w, h] of [[48, 48], [270, 386], [310, 126], [718, 146]]) {
      const geometry = getCrayonCardGeometry(w, h)!;
      expect(geometry).toEqual(getCrayonCardGeometry(w, h));
      expect(geometry.outline.match(/M /g)).toHaveLength(1);
      expect(geometry.outline.trim().endsWith("Z")).toBe(true);
      const coordinates = geometry.outline.match(/-?(?:\d*\.)?\d+/g)!.map(Number);
      coordinates.forEach((value, index) => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(index % 2 ? h : w);
      });
    }
  });

  it("omits edge strokes on a narrow card without losing its outline", () => {
    const narrow = getCrayonCardGeometry(80, 128)!;
    expect(narrow.outline).toBeTruthy();
    expect(narrow.accents).toEqual([]);
    expect(getCrayonCardGeometry(270, 128)?.accents).toHaveLength(3);
  });
});
