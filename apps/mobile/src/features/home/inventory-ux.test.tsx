import * as React from "react";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { ExpirySource, ItemStatus, UnitCode, type InventoryItem } from "@expirymate/shared";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { InventoryCard } from "../../components/InventoryCard";
import { IngredientEntryMethodSheet } from "../registration/ingredient-entry-method-sheet";

// Validate rendered feature content and callbacks, with native primitives replaced.
// These tests do not measure native layout or screen-reader focus.
const state = vi.hoisted(() => ({
  preferred: null as string | null,
  drafts: 0,
  shouldStack: false,
  isRegular: false,
  setPreferredEntryMethod: vi.fn(),
}));
vi.mock("react", async (original) => ({ ...await original<typeof import("react")>(), useMemo: (fn: () => unknown) => fn() }));
vi.mock("react-native", () => ({ View: "View", Pressable: "Pressable", Platform: { select: (options: { default?: unknown }) => options.default }, StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 } }));
vi.mock("react-native-svg", () => ({ default: "Svg", Circle: "Circle", Path: "Path" }));
vi.mock("lucide-react-native", () => ({ Check: "Check", CircleMinus: "CircleMinus", Barcode: "Barcode", ChevronRight: "ChevronRight", ImageIcon: "ImageIcon", PenLine: "PenLine" }));
vi.mock("../../components/AppText", () => ({ AppText: "AppText" }));
vi.mock("../../components/Button", () => ({ Button: "Button" }));
vi.mock("../../components/BottomSheet", () => ({ BottomSheet: "BottomSheet" }));
vi.mock("../../components/ContentSkeleton", () => ({ SkeletonBlock: "SkeletonBlock" }));
vi.mock("../../shared/fonts", () => ({ fontFamily: {}, fontFamilyForWeight: () => "TestFont" }));
vi.mock("../../shared/responsive-layout", () => ({ useResponsiveLayout: () => ({ shouldStack: state.shouldStack, shouldStackDense: state.shouldStack, isRegular: state.isRegular }) }));
vi.mock("../spaces/space-provider", () => ({ useActiveSpace: () => ({ activeSpaceId: "space-a" }) }));
vi.mock("../../store/registration-store", () => ({
  useRegistrationStore: (selector: (value: unknown) => unknown) => selector({ setPreferredEntryMethod: state.setPreferredEntryMethod }),
  preferredEntryMethodForSpace: () => state.preferred,
  photoDraftForSpace: () => Array.from({ length: state.drafts }),
}));

type Props = { children?: ReactNode; testID?: string; onPress?: () => void; accessibilityLabel?: string; numberOfLines?: number; variant?: string };
// Metro supplies the automatic JSX runtime; Vitest uses the classic transform here.
vi.stubGlobal("React", React);
afterAll(() => vi.unstubAllGlobals());
function elements(tree: ReactNode): ReactElement<Props>[] {
  return Children.toArray(tree).flatMap((child) => isValidElement<Props>(child)
    ? [child, ...elements(child.props.children)] : []);
}
function byId(tree: ReactNode, id: string) {
  const element = elements(tree).find((node) => node.props.testID === id);
  if (!element) throw new Error(`Missing ${id}`);
  return element;
}
function text(tree: ReactNode): string {
  return Children.toArray(tree).map((child): string => isValidElement<Props>(child) ? text(child.props.children) : String(child)).join("");
}
afterEach(() => {
  state.preferred = null;
  state.drafts = 0;
  state.shouldStack = false;
  state.isRegular = false;
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("registration method predictability", () => {
  it.each([null, "scan", "photo", "manual"])("keeps positions fixed with recent method %s and a draft", (preferred) => {
    state.preferred = preferred;
    state.drafts = 3;
    const onPhoto = vi.fn();
    const tree = IngredientEntryMethodSheet({ visible: true, onClose: vi.fn(), onScan: vi.fn(), onManual: vi.fn(), onPhoto });
    expect(elements(tree).map((node) => node.props.testID).filter((id) => /ingredient-entry-(scan|photo|manual)-button/.test(id ?? "")))
      .toEqual(["ingredient-entry-scan-button", "ingredient-entry-photo-button", "ingredient-entry-manual-button"]);
    expect(text(byId(tree, "ingredient-entry-photo-draft"))).toContain("확인 중인 재료 3개 이어서");
    byId(tree, "ingredient-entry-resume-photo-button").props.onPress?.();
    expect(onPhoto).toHaveBeenCalledOnce();
    expect(state.setPreferredEntryMethod).toHaveBeenCalledWith("space-a", "photo");
    expect(text(tree).match(/최근 사용/g)?.length ?? 0).toBe(preferred ? 1 : 0);
  });
  it("hides photo entry and draft restoration when the feature is unavailable", () => {
    state.preferred = "photo";
    state.drafts = 3;
    const onScan = vi.fn(), onManual = vi.fn();
    const tree = IngredientEntryMethodSheet({ visible: true, onClose: vi.fn(), onScan, onManual });
    expect(text(tree)).not.toMatch(/사진|초안|최근 사용/);
    byId(tree, "ingredient-entry-scan-button").props.onPress?.();
    byId(tree, "ingredient-entry-manual-button").props.onPress?.();
    expect(onScan).toHaveBeenCalledOnce();
    expect(onManual).toHaveBeenCalledOnce();
  });
  it("shows the photo choice without a resume section when no draft exists", () => {
    const onPhoto = vi.fn();
    const tree = IngredientEntryMethodSheet({ visible: true, onClose: vi.fn(), onScan: vi.fn(), onManual: vi.fn(), onPhoto });
    expect(text(tree)).not.toContain("초안");
    byId(tree, "ingredient-entry-photo-button").props.onPress?.();
    expect(onPhoto).toHaveBeenCalledOnce();
  });
});

describe("inventory row clarity", () => {
  const item: InventoryItem = { id: "milk", displayName: "긴 이름의 우유", quantity: 2, unit: "개", quantityBase: 2, unitCode: UnitCode.EA, storageLocation: "fridge", expiryDate: null, expirySource: ExpirySource.UNKNOWN, status: ItemStatus.ACTIVE, createdAt: "2026-09-10T00:00:00Z", updatedAt: "2026-09-10T00:00:00Z" };
  it.each([["2026-09-07", "3일 지남"], ["2026-09-10", "오늘까지"], ["2026-09-13", "3일 남음"], [null, "기한 미입력"]])("explains expiry %s without D-day notation", (expiryDate, label) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T03:00:00Z"));
    const tree = InventoryCard({ item: { ...item, expiryDate }, onPress: vi.fn() });
    expect(elements(tree).find((node) => node.props.accessibilityLabel?.startsWith(item.displayName))?.props.accessibilityLabel).toContain(label);
  });
  it.each([false, true])("keeps usage separate from editing and leaves text wrapping enabled (stacked: %s)", (stacked) => {
    state.shouldStack = stacked;
    const onPress = vi.fn(), onCleanup = vi.fn();
    const tree = InventoryCard({ item, onPress, onCleanup });
    const action = byId(tree, "inventory-item-cleanup-button");
    expect(text(action)).toBe("사용 기록");
    action.props.onPress?.();
    expect(onCleanup).toHaveBeenCalledWith(item);
    expect(onPress).not.toHaveBeenCalled();
    expect(elements(tree).every((node) => node.props.numberOfLines === undefined)).toBe(true);
  });
  it("omits usage recording during selection", () => {
    const tree = InventoryCard({ item, onPress: vi.fn(), onCleanup: vi.fn(), selectionMode: true });
    expect(text(tree)).not.toContain("사용 기록");
  });
});
