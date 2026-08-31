import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const MOBILE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function read(relativePath: string) {
  return readFileSync(join(MOBILE_ROOT, relativePath), "utf8");
}

describe("inventory row interaction contract", () => {
  it("opens quick editing from the row and usage cleanup from the trailing action", () => {
    const screen = read("app/(tabs)/inventory.tsx");
    const card = read("src/components/InventoryCard.tsx");
    const sheets = read("src/features/inventory/inventory-list-sheets.tsx");
    const editScreen = read("app/inventory/[id].tsx");

    expect(screen).toMatch(
      /const handleCardPress[\s\S]*?setQuickEditItem\(item\);/,
    );
    expect(screen).toContain("<InventoryQuickEditSheet");
    expect(screen).toContain("params: { id: item.id, mode }");
    expect(screen).toContain("onCleanup={openCleanupSheet}");
    expect(sheets).toContain("남은 양 바꾸기");
    expect(sheets).toContain("유통기한 바꾸기");
    expect(sheets).toContain("보관 위치 바꾸기");
    expect(sheets).toContain("전체 내용 수정하기");
    expect(editScreen).toContain('const isQuickEdit = editMode !== "product"');
    expect(editScreen).toContain(
      "onPress={isSaveAction ? handleSave : goToNextEditStep}",
    );
    expect(editScreen).toContain(
      "const visibleEditSteps = isQuickEdit ? [activeEditStep] : EDIT_STEPS",
    );
    expect(editScreen).toContain("currentIndex={isQuickEdit ? 0");
    expect(card).toContain("<CircleMinus");
    expect(card).toContain("사용량 반영");
    expect(card).toContain("onPress={() => onCleanup(item)}");
    expect(card).not.toContain("<PenLine");
  });

  it("uses the shared traffic-light accents for D-day badges", () => {
    const card = read("src/components/InventoryCard.tsx");

    expect(card).toContain("expired: colors.expiryExpiredAccent");
    expect(card).toContain("within_7_days: colors.expiryExpiringAccent");
    expect(card).toContain("safe: colors.expirySafeAccent");
    expect(card).toMatch(
      /expiryLampText:[\s\S]*?color: colors\.expiryAccentForeground/,
    );
  });
});
