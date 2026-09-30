import * as React from "react";
import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ShoppingItem } from "@expirymate/shared";
import { ShoppingListPanel } from "./shopping-list-panel";
import { OpenedInventoryFields } from "../inventory/opened-inventory-fields";
const state = vi.hoisted(() => ({
  hooks: [] as unknown[],
  index: 0,
  items: [] as ShoppingItem[],
  draft: null as null | { displayName: string },
  change: vi.fn(),
  findProducts: vi.fn(),
  push: vi.fn(),
  alert: vi.fn(),
  setDraft: vi.fn(),
  clearPrefill: vi.fn(),
  form: { name: "", quantity: 1, unit: "개" },
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = state.index++;
    if (!(index in state.hooks)) state.hooks[index] = initial;
    return [
      state.hooks[index],
      (value: unknown) => {
        state.hooks[index] =
          typeof value === "function" ? value(state.hooks[index]) : value;
      },
    ];
  },
}));
vi.mock("react-native", () => ({
  View: "View",
  Pressable: "Pressable",
  ActivityIndicator: "Spinner",
  StyleSheet: { create: (s: unknown) => s },
  Alert: { alert: state.alert },
}));
vi.mock("expo-router", () => ({ router: { push: state.push } }));
vi.mock("lucide-react-native", () => ({
  Check: "Check",
  MoreHorizontal: "MoreHorizontal",
  Plus: "Plus",
  Square: "Square",
}));
vi.mock("react-hook-form", () => ({
  Controller: "Controller",
  useForm: () => ({
    control: {},
    reset: (value: typeof state.form) => {
      state.form = value;
    },
    handleSubmit: (fn: (value: typeof state.form) => unknown) => () =>
      fn(state.form),
  }),
}));
vi.mock("../../shared/fonts", () => ({
  fontFamily: {},
  fontFamilyForWeight: () => "TestFont",
}));
vi.mock("../../components/AppText", () => ({ AppText: "AppText" }));
vi.mock("../../components/Button", () => ({ Button: "Button" }));
vi.mock("../../components/AppTextInput", () => ({ AppTextInput: "Input" }));
vi.mock("../../components/BottomSheet", () => ({ BottomSheet: "Sheet" }));
vi.mock("../../components/FormField", () => ({ FormField: "Field" }));
vi.mock("../../components/Pill", () => ({ Pill: "Pill" }));
vi.mock("../../components/EmptyState", () => ({ EmptyState: "EmptyState" }));
vi.mock("../../components/FeedbackBanner", () => ({
  FeedbackBanner: "Banner",
}));
vi.mock("../../components/DatePickerField", () => ({
  DatePickerField: "DatePicker",
}));
vi.mock("../spaces/space-provider", () => ({
  useActiveSpace: () => ({ activeSpaceId: "space-a" }),
}));
vi.mock("../../store/registration-store", () => ({
  useRegistrationStore: {
    getState: () => ({
      drafts: { "space-a": state.draft },
      clearPrefill: state.clearPrefill,
      setDraft: state.setDraft,
    }),
  },
}));
vi.mock("./use-shopping-list", () => ({
  useShoppingList: () => ({
    query: { data: { items: state.items } },
    change: state.change,
    isPending: false,
    ready: true,
  }),
}));
vi.stubGlobal("React", React);
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => {
  vi.clearAllMocks();
  state.hooks = [];
  state.index = 0;
  state.items = [];
  state.draft = null;
  state.change.mockResolvedValue({});
});
type Props = {
  children?: ReactNode;
  onPress?: () => unknown;
  onChange?: (value: string) => unknown;
  accessibilityRole?: string;
  accessibilityLabel?: string;
  label?: string;
  visible?: boolean;
  footer?: ReactNode;
};
function nodes(tree: ReactNode): ReactElement<Props>[] {
  return Children.toArray(tree).flatMap((node) =>
    isValidElement<Props>(node)
      ? [node, ...nodes(node.props.children), ...nodes(node.props.footer)]
      : [],
  );
}
function text(tree: ReactNode): string {
  return Children.toArray(tree)
    .map((node): string =>
      isValidElement<Props>(node) ? text(node.props.children) : String(node),
    )
    .join("");
}
function press(tree: ReactNode, label: string) {
  const button = nodes(tree).find(
    (node) =>
      node.props.onPress &&
      (text(node) === label || node.props.accessibilityLabel === label),
  );
  if (!button) throw Error(`Missing ${label}`);
  return button.props.onPress!();
}
function render() {
  state.index = 0;
  return ShoppingListPanel({
    suggestedNames: [],
    onFindProducts: state.findProducts,
  });
}
const item: ShoppingItem = {
  id: "shop-1",
  spaceId: "space-a",
  name: "우유",
  quantity: 2,
  unit: "개",
  version: 3,
  completedAt: null,
  inventoryItemId: null,
  createdAt: "2026-09-29T00:00:00Z",
  updatedAt: "2026-09-29T00:00:00Z",
};
describe("shopping and opened controls", () => {
  it("opens related products from the item details", () => {
    state.items = [item];
    press(render(), "우유 2개, 관련 상품 보기");
    expect(state.findProducts).toHaveBeenCalledWith("우유");
  });
  it("moves item editing and deletion into a management menu", async () => {
    state.items = [item];
    const tree = render();
    expect(text(tree)).not.toContain("삭제");
    const manage = nodes(tree).find(
      (node) => node.props.accessibilityLabel === "우유 관리",
    );
    manage?.props.onPress?.();
    expect(state.alert).toHaveBeenCalledWith(
      "우유 관리",
      undefined,
      expect.any(Array),
    );
    const menu = state.alert.mock.calls[0]?.[2] as {
      text: string;
      onPress?: () => void;
    }[];
    menu.find((action) => action.text === "수정")?.onPress?.();
    expect(state.form).toEqual({ name: "우유", quantity: 2, unit: "개" });
    menu.find((action) => action.text === "삭제")?.onPress?.();
    expect(state.alert).toHaveBeenLastCalledWith(
      "목록에서 삭제할까요?",
      expect.stringContaining("우유"),
      expect.any(Array),
    );
    const confirmation = state.alert.mock.calls[1]?.[2] as {
      text: string;
      onPress?: () => void;
    }[];
    confirmation.find((action) => action.text === "삭제")?.onPress?.();
    await Promise.resolve();
    expect(state.change).toHaveBeenCalledWith({
      action: "delete",
      id: "shop-1",
      expectedVersion: 3,
    });
  });
  it("checks purchase completion using the displayed version", async () => {
    state.items = [item];
    const checkbox = nodes(render()).find(
      (node) => node.props.accessibilityRole === "checkbox",
    );
    checkbox?.props.onPress?.();
    await Promise.resolve();
    expect(state.change).toHaveBeenCalledWith({
      action: "update",
      id: "shop-1",
      body: { completed: true, expectedVersion: 3 },
    });
  });
  it("prefills inventory registration in the current space after purchase", () => {
    state.items = [{ ...item, completedAt: "2026-09-29T00:00:00Z" }];
    press(render(), "구매 완료 1개 보기");
    press(render(), "우유 2개, 보관함에 등록");
    expect(state.setDraft).toHaveBeenCalledWith("space-a", {
      shoppingListItemId: "shop-1",
      displayName: "우유",
      quantity: 2,
      unit: "개",
    });
    expect(state.push).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({ returnTo: "shop" }),
      }),
    );
  });
  it("does not replace an existing registration draft without confirmation", () => {
    state.draft = { displayName: "작성 중" };
    state.items = [{ ...item, completedAt: "2026-09-29T00:00:00Z" }];
    press(render(), "구매 완료 1개 보기");
    press(render(), "우유 2개, 보관함에 등록");
    expect(state.alert).toHaveBeenCalled();
    expect(state.setDraft).not.toHaveBeenCalled();
    expect(state.push).not.toHaveBeenCalled();
  });
  it("opens an editable form and sends one validated create request", async () => {
    press(render(), "목록에 추가");
    state.form = { name: "두부", quantity: 3, unit: "개" };
    await press(render(), "목록에 저장");
    expect(state.change).toHaveBeenCalledWith({
      action: "create",
      body: { name: "두부", quantity: 3, unit: "개" },
    });
  });
  it("clears the check date separately and clears both dates when removing opening", () => {
    const onChange = vi.fn();
    const tree = OpenedInventoryFields({
      openedDate: "2026-09-20",
      openedCheckDate: "2026-09-29",
      onChange,
    });
    press(tree, "확인일 지우기");
    expect(onChange).toHaveBeenLastCalledWith("2026-09-20", null);
    press(tree, "개봉 기록 지우기");
    expect(onChange).toHaveBeenLastCalledWith(null, null);
    expect(text(tree)).toContain("원래 유통기한은 유지돼요");
  });
});
