import * as React from "react";
import { Children, isValidElement, type ReactNode, type ReactElement } from "react";
import { ExpirySource } from "@expirymate/shared";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { applyPhotoBulkChange, photoBulkTargets } from "./photo-bulk-edit";
import { PhotoBulkEditPanel } from "./photo-bulk-edit-panel";
import type { PhotoIntakeDraftItem } from "./photo-intake-draft";

// Re-render feature output with hook state; native layout remains a device QA gate.
const hooks = vi.hoisted(() => ({ values: [] as unknown[], index: 0 }));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = hooks.index++;
    if (!(index in hooks.values)) hooks.values[index] = initial;
    return [hooks.values[index], (value: unknown) => {
      hooks.values[index] = typeof value === "function" ? value(hooks.values[index]) : value;
    }];
  },
}));
vi.mock("react-native", () => ({ View: "View", StyleSheet: { create: (styles: unknown) => styles } }));
vi.mock("../../components/AppText", () => ({ AppText: "AppText" }));
vi.mock("../../components/Button", () => ({ Button: "Button" }));
vi.mock("../../components/FeedbackBanner", () => ({ FeedbackBanner: "FeedbackBanner" }));
vi.mock("../../shared/fonts", () => ({ fontFamily: {}, fontFamilyForWeight: () => "TestFont" }));
vi.mock("../inventory/inventory-form-ui", () => ({ QuickExpiryPills: "QuickExpiryPills" }));
vi.stubGlobal("React", React);
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => { hooks.values = []; hooks.index = 0; });

const makeItem = (localId: string, overrides: Partial<PhotoIntakeDraftItem> = {}): PhotoIntakeDraftItem => ({
  localId, displayName: localId, quantity: 1, storageLocation: "", expiryDate: null,
  expirySource: ExpirySource.MANUAL, needsReview: true, ...overrides,
});
const fixture = () => [
  makeItem("missing"),
  makeItem("edited", { storageLocation: "freezer", expiryDate: "2026-09-20" }),
  makeItem("unknown", { storageLocation: "fridge", expirySource: ExpirySource.UNKNOWN }),
];

describe("photo bulk editing scope", () => {
  it("fills only missing dates and preserves explicitly unknown dates and review status", () => {
    const items = fixture();
    const result = applyPhotoBulkChange(items, { field: "expiry", expiryDate: "2026-09-15", expirySource: ExpirySource.PRESET }, "missing");
    expect(result.changedCount).toBe(1);
    expect(result.items[0]).toMatchObject({ expiryDate: "2026-09-15", needsReview: true });
    expect(result.items[1]).toBe(items[1]);
    expect(result.items[2]).toBe(items[2]);
    expect(items[0].expiryDate).toBeNull();
  });
  it("preserves populated locations including defaults and handles blank input", () => {
    const items = fixture();
    items[0].storageLocation = "  ";
    expect(photoBulkTargets(items, "location", "missing")).toHaveLength(1);
    const result = applyPhotoBulkChange(items, { field: "location", storageLocation: "pantry" }, "missing");
    expect(result.changedCount).toBe(1);
    expect(result.items.map((item) => item.storageLocation)).toEqual(["pantry", "freezer", "fridge"]);
  });
  it("overwrites all only when explicitly requested, without changing unrelated fields", () => {
    const items = fixture();
    const result = applyPhotoBulkChange(items, { field: "expiry", expiryDate: null, expirySource: ExpirySource.UNKNOWN }, "all");
    expect(result.changedCount).toBe(2);
    expect(result.items.every((item) => item.expirySource === ExpirySource.UNKNOWN)).toBe(true);
    expect(result.items.map((item) => item.storageLocation)).toEqual(items.map((item) => item.storageLocation));
  });
  it("does not create a change for identical values or an empty list", () => {
    const items = [makeItem("a", { storageLocation: "fridge" })];
    expect(applyPhotoBulkChange(items, { field: "location", storageLocation: "fridge" }, "all")).toEqual({ items, changedCount: 0 });
    expect(applyPhotoBulkChange([], { field: "location", storageLocation: "fridge" }, "missing").changedCount).toBe(0);
  });
});

type Props = { children?: ReactNode; onPress?: () => void; onAction?: () => void; onSelect?: (date: string) => void; title?: string; actionLabel?: string; testID?: string };
function nodes(tree: ReactNode): ReactElement<Props>[] {
  return Children.toArray(tree).flatMap((node) => isValidElement<Props>(node) ? [node, ...nodes(node.props.children)] : []);
}
function text(tree: ReactNode): string {
  return Children.toArray(tree).map((node): string => isValidElement<Props>(node) ? text(node.props.children) : String(node)).join("");
}
function button(tree: ReactNode, label: string) {
  const result = nodes(tree).find((node) => node.props.onPress && text(node) === label);
  if (!result) throw Error(`Missing button: ${label}`);
  return result;
}
function setup() {
  let items = fixture();
  return {
    get items() { return items; },
    edit() { items = items.map((item) => ({ ...item, quantity: 2 })); },
    render() {
      hooks.index = 0;
      return PhotoBulkEditPanel({ items, locations: [{ key: "pantry", label: "실온" }], onChange: (expected, next) => { if (items === expected) items = next; } });
    },
  };
}
describe("photo bulk controls", () => {
  it("shows counts per field and can undo a missing-only edit", () => {
    const ui = setup(), original = ui.items;
    let tree = ui.render();
    expect(text(tree)).toContain("보관 위치 · 적용 대상 1개");
    expect(text(tree)).toContain("유통기한 · 적용 대상 1개");
    button(tree, "실온").props.onPress?.();
    tree = ui.render();
    expect(ui.items[1]).toBe(original[1]);
    nodes(tree).find((node) => node.props.actionLabel === "되돌리기")?.props.onAction?.();
    expect(ui.items).toBe(original);
  });
  it("requires confirmation for all-item overwrite and allows cancellation", () => {
    const ui = setup(), original = ui.items;
    button(ui.render(), "전체 덮어쓰기").props.onPress?.();
    button(ui.render(), "실온").props.onPress?.();
    expect(ui.items).toBe(original);
    expect(text(ui.render())).toContain("이미 입력하거나 개별 수정한 값도 바뀌어요.");
    button(ui.render(), "취소").props.onPress?.();
    expect(ui.items).toBe(original);
    button(ui.render(), "실온").props.onPress?.();
    button(ui.render(), "3개 덮어쓰기").props.onPress?.();
    expect(ui.items.every((item) => item.storageLocation === "pantry")).toBe(true);
  });
  it("drops stale confirmations and undo after a later edit", () => {
    const ui = setup();
    button(ui.render(), "전체 덮어쓰기").props.onPress?.();
    button(ui.render(), "실온").props.onPress?.();
    ui.edit();
    expect(nodes(ui.render()).some((node) => node.props.testID === "photo-bulk-overwrite-confirmation")).toBe(false);
    button(ui.render(), "실온").props.onPress?.();
    button(ui.render(), "3개 덮어쓰기").props.onPress?.();
    ui.edit();
    expect(nodes(ui.render()).some((node) => node.props.actionLabel === "되돌리기")).toBe(false);
    expect(ui.items.every((item) => item.quantity === 2)).toBe(true);
  });
});
