import { crayonSpeechBubble, radius, spacing } from "@expirymate/shared";
import { describe, expect, it } from "vitest";
import { getCrayonSpeechBubbleGeometry } from "./crayon-speech-bubble";

describe("crayon speech contour", () => {
  it.each([
    [0, 0], [47, 40], [48, 39], [-1, 60], [NaN, 60], [120, Infinity],
  ])("falls back before layout or for unsafe bounds %s × %s", (width, height) => {
    expect(getCrayonSpeechBubbleGeometry({ width, height })).toBeNull();
  });

  it.each(["default", "compact"] as const)(
    "keeps the tail between corners and within the drawing frame at %s density",
    (density) => {
      for (const width of [48, 120, 196, 320, 640]) {
        for (const height of [40, 48, 72, 120, 320, 640]) {
          const shape = getCrayonSpeechBubbleGeometry({ width, height, density });
          expect(shape).not.toBeNull();
          if (!shape) continue;
          const { inset, tailTipInset, grainStrokeWidth } = crayonSpeechBubble;
          expect(shape.outline).not.toMatch(/NaN|Infinity/);
          expect(shape.outline.endsWith("Z")).toBe(true);
          expect(shape.tailCenter - shape.tailHalfHeight).toBeGreaterThanOrEqual(
            inset + shape.corner,
          );
          expect(shape.tailCenter + shape.tailHalfHeight).toBeLessThanOrEqual(
            height - inset - shape.corner,
          );
          expect(grainStrokeWidth / 2).toBeLessThan(inset);
          expect(grainStrokeWidth / 2).toBeLessThan(tailTipInset);
          const gap = density === "compact" ? spacing.xs : spacing.sm;
          expect(gap + spacing.xs - shape.outset + tailTipInset).toBeGreaterThan(0);
        }
      }
    },
  );

  it("matches compact corners and centers its tail without changing the default radius", () => {
    const bounds = { width: 196, height: 120 };
    const compact = getCrayonSpeechBubbleGeometry({ ...bounds, density: "compact" });
    const normal = getCrayonSpeechBubbleGeometry(bounds);
    expect(compact?.corner).toBe(radius.lg - crayonSpeechBubble.inset);
    expect(normal?.corner).toBe(radius.xxl - crayonSpeechBubble.inset);
    expect(compact?.tailCenter).toBe(bounds.height / 2);
    expect(normal?.tailCenter).toBe(bounds.height - crayonSpeechBubble.tailBottomOffset);
  });
});
