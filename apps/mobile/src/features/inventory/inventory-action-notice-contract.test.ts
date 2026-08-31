import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const MOBILE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function read(relativePath: string) {
  return readFileSync(join(MOBILE_ROOT, relativePath), "utf8");
}

describe("inventory action notice contract", () => {
  it("keeps the Home-style Jango hero inside the filter section", () => {
    const screen = read("app/(tabs)/inventory.tsx");
    const feedbackBanner = feedbackBannerContract();
    const filterHeader = read(
      "src/features/inventory/inventory-list-header.tsx",
    );
    const filterStyles = read(
      "src/features/inventory/inventory-screen-styles.ts",
    );

    expect(screen).toContain("const inventoryActionNotice = actionError");
    expect(screen).toContain("deferredRemoval.undoLabel");
    expect(screen).toContain('actionLabel="되돌릴게요"');
    expect(screen).toContain("deferredRemoval.undoRemoval()");
    expect(screen).toContain("<JangoHeroNoticeCarousel");
    expect(screen).toContain(
      "inventoryFilterHero = inventoryActionNotice ?? inventoryDefaultHero",
    );
    expect(screen).toContain("heroContent={inventoryFilterHero}");
    expect(screen).toContain('speechDensity="default"');
    expect(screen).toContain('speechTextVariant="bodySmall"');
    expect(screen).toContain(
      'title={`${shoppingOfferTarget.displayName} 다 썼어요.`}',
    );
    expect(screen).not.toContain('description="다시 채워둘까요?"');
    expect(screen).toContain('actionLabel="장보기에서 찾아볼게요"');
    expect(screen).toContain('speechActionPlacement="inside"');
    expect(feedbackBanner).toContain('speechActionPlacement = "below"');
    expect(feedbackBanner).toContain(
      'speechActionPlacement === "inside"',
    );
    expect(feedbackBanner).toContain(
      'speechActionPlacement === "below"',
    );
    expect(feedbackBanner).toContain("inlineActionLabel");
    expect(feedbackBanner).not.toContain("textDecorationLine");
    expect(feedbackBanner).not.toContain("<Button");
    expect(screen).toContain('trackAffiliateEntryTap("inventory_consumed")');
    expect(screen).toContain('pathname: "/(tabs)/shop"');
    expect(screen).toContain('source: "inventory_consumed"');
    expect(screen).toContain('scheduleRemoval(item, "discard")');
    expect(screen).not.toContain("useBatchDiscardInventoryItems");
    expect(filterHeader).toContain("styles.filterToolbarDangerNotice");
    expect(filterHeader).toContain("styles.filterToolbarWarningNotice");
    expect(filterHeader).toContain("styles.filterToolbarSuccessNotice");
    expect(filterHeader).toMatch(
      /<View[\s\S]*?styles\.filterToolbar[\s\S]*?>\s*\{heroContent\}\s*<View style=\{styles\.filterCluster\}>/,
    );
    expect(filterStyles).toContain("backgroundColor: colors.dangerSoft");
    expect(filterStyles).toContain("backgroundColor: colors.warningSoft");
    expect(filterStyles).toContain("backgroundColor: colors.successSoft");
    expect(screen).not.toMatch(
      /<SpaceSwitcher \/>\s*\{inventoryActionNotice\}/,
    );
    expect(screen).not.toContain("inventoryHeroBubble");
    expect(screen).not.toContain("InventoryUndoSnackbar");
  });
});

function feedbackBannerContract() {
  return read("src/components/FeedbackBanner.tsx");
}
