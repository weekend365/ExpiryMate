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
    const shopping = read("app/shopping.tsx");
    const shoppingTab = read("app/(tabs)/shop.tsx");

    expect(shoppingTab).toContain("<ShoppingScreen inTabs />");
    expect(shopping).toContain('topInsetMode={inTabs ? "safe" : "none"}');
    expect(shopping).toContain(
      'bottomInsetMode={inTabs ? "navigator" : "system"}',
    );
  });
});
