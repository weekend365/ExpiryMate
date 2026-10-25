import * as React from "react";
import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { afterAll, describe, expect, it, vi } from "vitest";
import { opacity } from "@expirymate/shared";
import { Screen } from "../components/Screen";
import { ScreenBackground } from "../components/ScreenBackground";
import { SettingsScreen } from "../components/SettingsScreen";

vi.stubGlobal("React", React);
afterAll(() => vi.unstubAllGlobals());

vi.mock("react-native", () => ({
  View: "View", Image: "Image", ScrollView: "ScrollView", Pressable: "Pressable",
  KeyboardAvoidingView: "KeyboardAvoidingView", Platform: { OS: "ios" },
  StyleSheet: {
    create: (styles: unknown) => styles,
    absoluteFillObject: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  },
}));
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: "SafeAreaView", useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
vi.mock("expo-router", () => ({ router: { canGoBack: () => false } }));
vi.mock("lucide-react-native", () => ({ ChevronLeft: "ChevronLeft" }));
vi.mock("../components/AppText", () => ({ AppText: "AppText" }));
vi.mock("./fonts", () => ({
  fontFamily: { regular: "Pretendard-Regular", medium: "Pretendard-Medium" },
  fontFamilyForWeight: () => "Pretendard-Regular",
}));
vi.mock("./responsive-layout", async () => ({
  ...await import("./responsive-layout-core"),
  useResponsiveLayout: () => ({ width: 360, shouldStack: true }),
}));

type Element = ReactElement<{ children?: ReactNode; style?: unknown }>;
const elements = (node: ReactNode) => Children.toArray(node).filter(isValidElement) as Element[];

describe("screen scene behavior", () => {
  it("keeps existing screens image-free unless a preset is selected", () => {
    const tree = Screen({ children: createElement("Content") });
    expect(elements(tree.props.children).map(child => child.type)).toEqual(["KeyboardAvoidingView"]);
  });

  it("places decoration outside keyboard and scrolling layout while retaining the footer", () => {
    const tree = Screen({ background: "ingredients", children: createElement("Content"), footer: createElement("Save") });
    const [background, keyboard] = elements(tree.props.children);
    expect(background).toMatchObject({ type: ScreenBackground, props: { preset: "ingredients", treatment: "standard" } });
    expect(keyboard.type).toBe("KeyboardAvoidingView");
    const [scroll, footer] = elements(keyboard.props.children);
    expect(scroll.type).toBe("ScrollView");
    expect(elements(elements(footer.props.children)[0].props.children)[0].type).toBe("Save");
  });

  it("keeps the background hidden from gestures and accessibility and preserves the whole image", () => {
    const tree = ScreenBackground({ preset: "welcome" });
    expect(tree.props).toMatchObject({ pointerEvents: "none", accessible: false, "aria-hidden": true, focusable: false,
      accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" });
    expect(tree.props.style.position).toBe("absolute");
    const [image] = elements(tree.props.children);
    expect(image.props).toMatchObject({ resizeMode: "contain", accessible: false, fadeDuration: 0 });
  });

  it("uses a stronger paper overlay for reading without fading foreground content", () => {
    const standard = elements(ScreenBackground({ preset: "settings" }).props.children)[1];
    const reading = elements(ScreenBackground({ preset: "settings", treatment: "reading" }).props.children)[1];
    expect(standard.props.style).toContainEqual({ opacity: opacity.sceneVeil });
    expect(reading.props.style).toContainEqual({ opacity: opacity.sceneReadingVeil });
    expect(opacity.sceneReadingVeil).toBeGreaterThan(opacity.sceneVeil);
  });

  it("inherits the settings scene and lets shared spaces override it", () => {
    const defaultScreen = SettingsScreen({ children: createElement("Content") });
    expect(elements(defaultScreen.props.children)[0]).toMatchObject({ type: Screen, props: { background: "settings" } });
    const sharedScreen = SettingsScreen({ background: "sharing", backgroundTreatment: "reading" });
    expect(elements(sharedScreen.props.children)[0]).toMatchObject({ type: Screen,
      props: { background: "sharing", backgroundTreatment: "reading" } });
  });
});
