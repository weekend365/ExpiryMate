import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const MOBILE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function read(path: string) {
  return readFileSync(join(MOBILE_ROOT, path), "utf8");
}

describe("cooking flow resilience contract", () => {
  it("restores the local session before live inventory reconciliation", () => {
    const session = read("src/features/recipes/use-cooking-session.ts");
    const loadStart = session.indexOf("void loadCookingSessionDraft(draftKey)");
    const reconcileStart = session.indexOf(
      "setConsumptionChoices((current) =>\n      reconcileConsumptionChoices",
    );

    expect(loadStart).toBeGreaterThan(-1);
    expect(reconcileStart).toBeGreaterThan(loadStart);
    expect(session).toContain("inventoryQuery.isPending || inventoryQuery.isError");
  });

  it("keeps only active cooking steps awake and exposes an opt-out", () => {
    const screen = read("app/cooking/[recommendationId].tsx");
    const settings = read("app/(tabs)/settings.tsx");

    expect(screen).toContain("useKeepAwake(COOKING_KEEP_AWAKE_TAG)");
    expect(screen).toContain(
      "keepCookingScreenAwake && cookingStepIndex !== null",
    );
    expect(settings).toContain('title="조리 중 화면 켜두기"');
    expect(settings).toContain("setKeepCookingScreenAwake");
  });

  it("announces completion and offers recovery from draft save errors", () => {
    const timer = read("src/features/recipes/use-cooking-timer.ts");
    const screen = read("app/cooking/[recommendationId].tsx");

    expect(timer).toContain("Haptics.NotificationFeedbackType.Success");
    expect(timer).toContain("AccessibilityInfo.announceForAccessibility");
    expect(screen).toContain('testID="cooking-session-save-error"');
    expect(screen).toContain("retryCookingSessionSave");
  });

  it("supports hands-busy navigation with a large CTA, swipe, and haptics", () => {
    const screen = read("app/cooking/[recommendationId].tsx");

    expect(screen).toContain("Gesture.Pan()");
    expect(screen).toContain("styles.handsBusyButton");
    expect(screen).toContain("Haptics.NotificationFeedbackType.Success");
    expect(screen).toContain("왼쪽으로 밀면 다음 단계");
  });

  it("opens a responsive overview from progress and exposes timer state", () => {
    const screen = read("app/cooking/[recommendationId].tsx");
    const stepFlow = read("src/components/StepFlow.tsx");

    expect(stepFlow).toContain("onProgressPress");
    expect(stepFlow).toContain("전체 단계 보기");
    expect(screen).toContain('testID="cooking-steps-overview"');
    expect(screen).toContain("shouldStack && styles.overviewRowStacked");
    expect(screen).toContain("타이머 연결됨");
  });

  it("separates completion from cleanup and keeps cleanup recoverable on home", () => {
    const screen = read("app/cooking/[recommendationId].tsx");
    const home = read("app/(tabs)/home.tsx");
    const cleanupCard = read(
      "src/features/recipes/pending-cooking-cleanup-card.tsx",
    );

    expect(screen).toContain('testID="cooking-completion-moment"');
    expect(screen).toContain("나중에 정리");
    expect(screen).toContain("setPendingCookingCleanup");
    expect(home).toContain("PendingCookingCleanupCard");
    expect(cleanupCard).toContain('cleanup: "1"');
  });
});
