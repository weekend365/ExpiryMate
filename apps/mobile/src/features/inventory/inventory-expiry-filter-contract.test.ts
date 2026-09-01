import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const MOBILE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function read(relativePath: string) {
  return readFileSync(join(MOBILE_ROOT, relativePath), "utf8");
}

describe("inventory expiry filter contract", () => {
  it("renders the unknown-expiry lamp with a neutral question-mark glyph", () => {
    const header = read("src/features/inventory/inventory-list-header.tsx");
    const icon = read("src/components/ExpiryTrafficIcon.tsx");
    const statCard = read("src/components/StatCard.tsx");
    const home = read("app/(tabs)/home.tsx");
    const homeStyles = read("src/features/home/home-screen-styles.ts");

    expect(header).toMatch(
      /label="확인"[\s\S]*?count=\{facetCounts\.status\.unknown\}[\s\S]*?tone="unknown"/,
    );
    expect(header.indexOf('label="확인"')).toBeLessThan(
      header.indexOf('label="만료"'),
    );
    expect(header.indexOf('label="만료"')).toBeLessThan(
      header.indexOf('label="곧"'),
    );
    expect(header.indexOf('label="곧"')).toBeLessThan(
      header.indexOf('label="여유"'),
    );
    expect(header).toContain(
      "유통기한을 모르는 재료만 보여 드릴게요.",
    );
    expect(icon).toContain('| "unknown"');
    expect(icon).toContain('if (tone === "unknown")');
    expect(icon).toContain('fill: colors.mutedText');
    expect(icon).toContain('strokeWidth="3.25"');
    expect(icon).toContain('cy="43"');
    expect(icon).toContain('r="1.8"');
    expect(statCard).toContain("unknown: {");
    expect(statCard).toContain("glow: colors.mutedText");
    expect(home).toMatch(
      /label="확인"[\s\S]*?value=\{unknownExpiryCount\}[\s\S]*?tone="unknown"/,
    );
    expect(home).toContain("styles.trafficLampActiveUnknown");
    expect(homeStyles).toMatch(
      /trafficLampActiveUnknown:[\s\S]*?backgroundColor: colors\.mutedSurface/,
    );
  });
});
