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
    const filterHeader = read(
      "src/features/inventory/inventory-list-header.tsx",
    );
    const filterStyles = read(
      "src/features/inventory/inventory-screen-styles.ts",
    );

    expect(screen).toContain("const inventoryActionNotice = actionError");
    expect(screen).toContain("deferredRemoval.undoLabel");
    expect(screen).not.toContain('actionLabel="되돌릴게요"');
    expect(screen).toContain("<JangoHeroNoticeCarousel");
    expect(screen).toContain(
      "inventoryFilterHero = inventoryActionNotice ?? inventoryDefaultHero",
    );
    expect(screen).toContain("heroContent={inventoryFilterHero}");
    expect(screen).toContain('speechDensity="default"');
    expect(screen).toContain('speechTextVariant="bodySmall"');
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
