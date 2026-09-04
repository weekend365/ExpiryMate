import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const MOBILE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath: string) {
  return readFileSync(join(MOBILE_ROOT, relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

describe("major flow deduplication contract", () => {
  it("lets the inventory hero own recovery while keeping the empty list layout visible", () => {
    const screen = read("app/(tabs)/inventory.tsx");
    const hero = read("src/features/inventory/inventory-hero.ts");

    expect(screen).not.toContain('from "../../src/components/EmptyState"');
    expect(screen).toContain("handleInventoryHeroAction");
    expect(screen).toContain("<InventoryEmptyListLayout />");
    expect(screen).toContain('testID="inventory-empty-list-layout"');
    expect(screen).toContain('"보관 중인 재료 0건"');
    expect(hero).toContain('actionLabel: "다시 시도"');
    expect(hero).toContain('actionLabel: "재료 넣기"');
    expect(hero).toContain('actionLabel: "필터 해제"');
  });

  it("keeps shopping state feedback in the catalog instead of the hero", () => {
    const screen = read("src/features/affiliate/ShoppingScreen.tsx");
    const hero = read("src/features/affiliate/shopping-hero.ts");

    expect(hero).not.toContain("찾아보는 중이에요");
    expect(hero).not.toContain("상품을 못 가져왔어요");
    expect(hero).not.toContain("이 이름으로는 상품이 안 보여요");
    expect(screen).toContain("상품을 불러오지 못했어요");
    expect(screen).toContain("일치하는 상품이 없어요");
  });

  it("keeps empty home section layouts visible and preserves the agreed priority", () => {
    const screen = read("app/(tabs)/home.tsx");
    const notices = read("src/features/home/home-notices.ts");

    expect(screen).toContain("!isInitialError && hasLoaded");
    expect(screen).toContain('title="오늘의 요리 추천"');
    expect(screen).toContain('title="유통기한 현황"');
    expect(screen).toContain("추천 요리가 여기에 보여요");
    expect(notices.indexOf("input.isInitialError")).toBeLessThan(
      notices.indexOf("input.expiringGroups.length > 0"),
    );
    expect(notices.indexOf("input.expiringGroups.length > 0")).toBeLessThan(
      notices.indexOf('input.recipeStatus === "pending"'),
    );
  });

  it("keeps photo analysis and review counts in one place each", () => {
    const screen = read("app/register-photo.tsx");

    expect(screen).toContain('if (step === "loading") return "사진 분석"');
    expect(screen).toContain('message="글자와 재료를 천천히 읽고 있어요."');
    expect(screen).not.toContain("저장 준비를 마쳤어요");
    expect(screen).not.toMatch(/`\$\{readyCount\}개 재료 추가`/);
    expect(screen).toContain('"확인된 재료 먼저 추가"');
  });

  it("keeps one actionable hero while previewing the empty recommendation layout", () => {
    const screen = read("app/(tabs)/recommendations.tsx");

    expect(screen).not.toContain("아직 냉장고가 비어 있어요");
    expect(screen).not.toContain("아직 추천이 없어요");
    expect(screen).toContain('title="이번에 골라볼 요리"');
    expect(screen).toContain("추천 요리가 여기에 보여요");
    expect(screen).toContain("{primaryCtaLabel}");
  });

  it("shares one completion hierarchy across manual and barcode entry", () => {
    const actions = read(
      "src/features/registration/registration-completion-actions.tsx",
    );
    const register = read("app/register.tsx");
    const scanner = read("src/features/scanner/scanner-confirm-sheet.tsx");

    expect(actions).toContain('variant="secondary"');
    expect(actions).toContain("추가 완료");
    expect(register).toContain("<RegistrationCompletionActions");
    expect(register).toContain('"다음 재료 직접 입력"');
    expect(scanner).toContain("<RegistrationCompletionActions");
    expect(scanner).toContain('primaryLabel="다음 재료 스캔"');
  });

  it("keeps shopping on the tab route and removes the duplicate success state", () => {
    const rootLayout = read("app/_layout.tsx");
    const cooking = read("app/cooking/[recommendationId].tsx");

    expect(existsSync(join(MOBILE_ROOT, "app/shopping.tsx"))).toBe(false);
    expect(rootLayout).not.toContain('name="shopping"');
    expect(cooking).toContain('title="요리를 다 마쳤어요"');
    expect(cooking).not.toContain("맛있게 완성했어요");
  });
});
