import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("global IAP lifecycle contract", () => {
  it("owns one root IAP connection and routes store screens through it", () => {
    const root = readFileSync(resolve(process.cwd(), "app/_layout.tsx"), "utf8");
    const subscription = readFileSync(
      resolve(process.cwd(), "app/settings/subscription.tsx"),
      "utf8",
    );
    const credits = readFileSync(
      resolve(process.cwd(), "app/settings/recommendation-credits.tsx"),
      "utf8",
    );

    expect(root).toContain("<IapPurchaseProvider>");
    expect(subscription).toContain("useIapStore({");
    expect(credits).toContain("useIapStore({");
    expect(subscription).not.toContain("useIAP({");
    expect(credits).not.toContain("useIAP({");
  });
});
