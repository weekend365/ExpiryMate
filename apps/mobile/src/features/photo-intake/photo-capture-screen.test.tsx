import * as React from "react";
import { Children, isValidElement, type ReactNode, type ReactElement } from "react";
import { afterAll, describe, expect, it, vi } from "vitest";
import { PhotoCaptureScreen } from "./photo-capture-screen";

const camera = vi.hoisted(() => ({ granted: true }));
vi.mock("expo-camera", () => ({ CameraView: "CameraView", useCameraPermissions: () => [{ granted: camera.granted, canAskAgain: true }, vi.fn()] }));
vi.mock("expo-status-bar", () => ({ StatusBar: "StatusBar" }));
vi.mock("lucide-react-native", () => ({ Camera: "Camera", ImageIcon: "ImageIcon", Info: "Info", ReceiptText: "ReceiptText", Refrigerator: "Refrigerator", Sparkles: "Sparkles" }));
vi.mock("react-native", () => ({ View: "View", ScrollView: "ScrollView", Pressable: "Pressable", ActivityIndicator: "ActivityIndicator", Linking: {}, StyleSheet: { create: (s: unknown) => s } }));
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
vi.mock("../../components/AppText", () => ({ AppText: "AppText" }));
vi.mock("../../components/Button", () => ({ Button: "Button" }));
vi.mock("../../components/MascotSpeechBubble", () => ({ MascotSpeechBubble: "MascotSpeechBubble" }));
vi.mock("../../shared/fonts", () => ({ fontFamily: {}, fontFamilyForWeight: () => "TestFont" }));
vi.mock("../../shared/responsive-layout", () => ({ useResponsiveLayout: () => ({ shouldStack: true, isPhoneLandscape: false }) }));
vi.mock("../scanner/scanner-chrome", () => ({ CloseButton: "CloseButton" }));
vi.stubGlobal("React", React);
afterAll(() => vi.unstubAllGlobals());

type NodeProps = { children?: ReactNode; testID?: string; onPress?: () => void; disabled?: boolean };
function nodes(tree: ReactNode): ReactElement<NodeProps>[] {
  return Children.toArray(tree).flatMap(node => isValidElement<NodeProps>(node) ? [node, ...nodes(node.props.children)] : []);
}
const props = {
  cameraRef: { current: null }, scene: "receipt" as const, accessLabel: "분석 1회 사용 가능", issue: null,
  isBusy: false, isActive: true, isCameraReady: true, onCameraReady: vi.fn(), onClose: vi.fn(),
  onSceneChange: vi.fn(), onCapture: vi.fn(), onOpenLibrary: vi.fn(), onShowAccessDetails: vi.fn(),
};

describe("photo continuation action", () => {
  it.each([true, false])("keeps an explicit album continuation available with camera permission %s", (granted) => {
    camera.granted = granted;
    const onPress = vi.fn();
    const tree = PhotoCaptureScreen({ ...props, continuation: { label: "이어서 사진 선택", onPress, disabled: false } });
    const button = nodes(tree).find(node => node.props.testID === "photo-continue-button")!;
    expect(button.props.children).toBe("이어서 사진 선택");
    expect(button.props.disabled).toBe(false);
    expect(onPress).not.toHaveBeenCalled();
    button.props.onPress?.();
    expect(onPress).toHaveBeenCalledOnce();
  });
  it.each([{ isBusy: true, disabled: false }, { isBusy: false, disabled: true }])("disables continuation while busy or gated: %s", ({ isBusy, disabled }) => {
    const tree = PhotoCaptureScreen({ ...props, isBusy, continuation: { label: "이어서 촬영", onPress: vi.fn(), disabled } });
    expect(nodes(tree).find(node => node.props.testID === "photo-continue-button")?.props.disabled).toBe(true);
  });
  it("does not add a continuation action before an interrupted selection", () => {
    expect(nodes(PhotoCaptureScreen(props)).some(node => node.props.testID === "photo-continue-button")).toBe(false);
  });
});
