import * as React from "react";
import { Children, isValidElement, type ReactNode, type ReactElement } from "react";
import { afterAll, beforeEach, expect, it, vi } from "vitest";
import OnboardingScreen from "../../../app/onboarding";

const state = vi.hoisted(() => ({ guide: false, complete: vi.fn(), replace: vi.fn() }));
vi.mock("react", async (original) => ({ ...await original<typeof import("react")>(), useState: () => [state.guide, (next: boolean) => { state.guide = next; }] }));
vi.mock("react-native", () => ({ View: "View", StyleSheet: { create: (styles: unknown) => styles } }));
vi.mock("expo-router", () => ({ router: { replace: state.replace } }));
vi.mock("../../store/app-store", () => ({ useAppStore: (select: (value: unknown) => unknown) => select({ completeOnboarding: state.complete }) }));
vi.mock("../../components/AppText", () => ({ AppText: "AppText" }));
vi.mock("../../components/Button", () => ({ Button: "Button" }));
vi.mock("../../components/BottomSheet", () => ({ BottomSheet: "BottomSheet" }));
vi.mock("../../components/Mascot", () => ({ Mascot: "Mascot" }));
vi.mock("../../components/Screen", () => ({ Screen: "Screen" }));
vi.mock("../../components/StatCard", () => ({ StatCard: "StatCard" }));
vi.mock("../../shared/fonts", () => ({ fontFamily: {}, fontFamilyForWeight: () => "TestFont" }));
vi.stubGlobal("React", React);
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => { state.guide = false; vi.clearAllMocks(); });
type Props = { children?: ReactNode; footer?: ReactNode; onPress?: () => void; onClose?: () => void; testID?: string; visible?: boolean; title?: string };
function nodes(tree: ReactNode): ReactElement<Props>[] {
  return Children.toArray(tree).flatMap((node) => isValidElement<Props>(node) ? [node, ...nodes(node.props.children), ...nodes(node.props.footer)] : []);
}
function text(tree: ReactNode): string {
  return Children.toArray(tree).map((node): string => isValidElement<Props>(node) ? text(node.props.children) : String(node)).join("");
}
it("starts login from the first screen and keeps the onboarding completion contract", () => {
  const tree = OnboardingScreen();
  const button = nodes(tree).find((node) => node.props.testID === "onboarding-next-button");
  expect(text(button)).toBe("로그인하고 시작하기");
  button?.props.onPress?.();
  expect(state.complete).toHaveBeenCalledOnce();
  expect(state.replace).toHaveBeenCalledWith("/auth/login");
  expect(state.complete.mock.invocationCallOrder[0]).toBeLessThan(state.replace.mock.invocationCallOrder[0]);
  expect(text(tree)).toContain("사용 예시 · 실제 보관함이 아니에요");
});
it("opens and closes optional guidance without marking onboarding complete or navigating", () => {
  nodes(OnboardingScreen()).find((node) => node.props.testID === "onboarding-guide-button")?.props.onPress?.();
  const sheet = nodes(OnboardingScreen()).find((node) => node.props.title === "장고 사용법");
  expect(sheet?.props.visible).toBe(true);
  sheet?.props.onClose?.();
  expect(nodes(OnboardingScreen()).find((node) => node.props.title === "장고 사용법")?.props.visible).toBe(false);
  expect(state.complete).not.toHaveBeenCalled();
  expect(state.replace).not.toHaveBeenCalled();
});
