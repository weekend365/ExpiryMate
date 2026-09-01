import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const MOBILE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function read(relativePath: string) {
  return readFileSync(join(MOBILE_ROOT, relativePath), "utf8");
}

describe("shopping screen layout contract", () => {
  it("uses safe top and navigator bottom insets inside the tab navigator", () => {
    const shopping = read("src/features/affiliate/ShoppingScreen.tsx");
    const shoppingTab = read("app/(tabs)/shop.tsx");

    expect(shoppingTab).toContain("<ShoppingScreen />");
    expect(shopping).toContain('topInsetMode="safe"');
    expect(shopping).toContain('bottomInsetMode="navigator"');
  });

  it("keeps shopping available only through the tab route", () => {
    const rootLayout = read("app/_layout.tsx");
    const screenshotManifest = read("scripts/layout-screenshot-manifest.mjs");

    expect(rootLayout).not.toContain('name="shopping"');
    expect(screenshotManifest).not.toContain('shopping: "shopping.png"');
  });
});
