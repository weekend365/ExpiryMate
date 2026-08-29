import type { InventoryPhotoParseScene } from "@expirymate/shared";
import { CameraView, useCameraPermissions } from "expo-camera";
import { StatusBar } from "expo-status-bar";
import {
  Camera,
  ImageIcon,
  Info,
  ReceiptText,
  Refrigerator,
  Sparkles,
} from "lucide-react-native";
import type { RefObject } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText } from "../../components/AppText";
import { Button } from "../../components/Button";
import { MascotSpeechBubble } from "../../components/MascotSpeechBubble";
import { useResponsiveLayout } from "../../shared/responsive-layout";
import {
  colors,
  radius,
  spacing,
  touchTarget,
} from "../../shared/theme";
import { CloseButton } from "../scanner/scanner-chrome";
import { scannerScreenStyles } from "../scanner/scanner-screen-styles";

type CaptureIssue = {
  title: string;
  description?: string;
};

export function PhotoCaptureScreen({
  cameraRef,
  scene,
  accessLabel,
  issue,
  isBusy,
  isActive,
  isCameraReady,
  onCameraReady,
  onClose,
  onSceneChange,
  onCapture,
  onOpenLibrary,
  onShowAccessDetails,
}: {
  cameraRef: RefObject<CameraView | null>;
  scene: InventoryPhotoParseScene;
  accessLabel: string;
  issue: CaptureIssue | null;
  isBusy: boolean;
  isActive: boolean;
  isCameraReady: boolean;
  onCameraReady: () => void;
  onClose: () => void;
  onSceneChange: (scene: InventoryPhotoParseScene) => void;
  onCapture: () => void;
  onOpenLibrary: () => void;
  onShowAccessDetails: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const { shouldStack, isPhoneLandscape } = useResponsiveLayout();
  const shouldStackTopBar = shouldStack && !isPhoneLandscape;
  const shouldUseCompactGuide = shouldStack || isPhoneLandscape;
  const hasPermission = permission?.granted ?? false;
  const canRequestPermission = permission?.canAskAgain ?? true;

  return (
    <View style={styles.root} testID="photo-capture-screen">
      <StatusBar style="light" />
      {hasPermission ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          active={isActive}
          animateShutter
          onCameraReady={onCameraReady}
        />
      ) : null}

      <SafeAreaView style={scannerScreenStyles.overlay}>
        <View
          style={[
            scannerScreenStyles.topBar,
            shouldStackTopBar && scannerScreenStyles.topBarStacked,
          ]}
        >
          <CloseButton
            onPress={onClose}
            accessibilityLabel="사진 등록을 닫을게요"
          />
          <View
            style={scannerScreenStyles.stepPill}
            accessible
            accessibilityLabel="2단계 중 1단계, 사진 선택"
          >
            <View style={scannerScreenStyles.stepProgress}>
              <View
                style={[
                  scannerScreenStyles.stepSegment,
                  scannerScreenStyles.stepSegmentActive,
                ]}
              />
              <View style={scannerScreenStyles.stepSegment} />
            </View>
            <Camera color={colors.surface} size={spacing.sm} strokeWidth={2.4} />
            <AppText
              variant="bodySmall"
              scaleRole="chrome"
              densityAware={false}
              style={scannerScreenStyles.stepPillText}
            >
              1/2 사진
            </AppText>
          </View>
        </View>

        {!hasPermission ? (
          <View style={scannerScreenStyles.centerStage}>
            <View style={scannerScreenStyles.centerCard}>
              <AppText style={scannerScreenStyles.centerTitle}>
                카메라가 필요해요
              </AppText>
              <MascotSpeechBubble
                message="영수증이나 냉장고를 찍으려면 카메라 권한을 허용해 주세요."
                mood="worry"
                size="small"
                style={scannerScreenStyles.centerBubble}
              />
              {canRequestPermission || permission == null ? (
                <Button
                  onPress={() => {
                    void requestPermission();
                  }}
                  disabled={permission == null}
                  fullWidth
                >
                  카메라 켤게요
                </Button>
              ) : (
                <Button
                  onPress={() => {
                    void Linking.openSettings();
                  }}
                  fullWidth
                >
                  설정에서 켤게요
                </Button>
              )}
              <Button variant="surface" onPress={onOpenLibrary} fullWidth>
                앨범에서 고를게요
              </Button>
            </View>
          </View>
        ) : (
          <View
            style={[
              styles.captureBody,
              isPhoneLandscape && styles.captureBodyLandscape,
            ]}
          >
            <View
              style={[
                styles.guideStage,
                isPhoneLandscape && styles.guideStageLandscape,
              ]}
              pointerEvents="none"
            >
              <View
                style={[
                  styles.guideCopy,
                  isPhoneLandscape && styles.guideCopyLandscape,
                ]}
              >
                <AppText
                  variant="bodyStrong"
                  tone="inverse"
                  style={styles.guideTitle}
                >
                  {scene === "receipt"
                    ? "영수증 전체가 보이게 맞춰 주세요"
                    : "재료가 겹치지 않게 보여 주세요"}
                </AppText>
                {!shouldUseCompactGuide ? (
                  <AppText
                    variant="caption"
                    tone="inverse"
                    style={styles.guideDescription}
                  >
                    {scene === "receipt"
                      ? "글자가 선명할수록 구매 목록을 더 잘 찾을 수 있어요."
                      : "밝은 곳에서 문 안쪽까지 담으면 여러 재료를 찾기 쉬워요."}
                  </AppText>
                ) : null}
              </View>
              <View
                style={[
                  styles.guideFrame,
                  shouldUseCompactGuide && styles.guideFrameCompact,
                  isPhoneLandscape && styles.guideFrameLandscape,
                ]}
              >
                <View style={[styles.corner, styles.cornerTopLeft]} />
                <View style={[styles.corner, styles.cornerTopRight]} />
                <View style={[styles.corner, styles.cornerBottomLeft]} />
                <View style={[styles.corner, styles.cornerBottomRight]} />
              </View>
            </View>

            <ScrollView
              style={[
                styles.bottomScroll,
                isPhoneLandscape && styles.bottomScrollLandscape,
              ]}
              contentContainerStyle={[
                styles.bottomStack,
                isPhoneLandscape && styles.bottomStackLandscape,
              ]}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {issue ? (
                <View style={styles.issueCard} accessibilityLiveRegion="polite">
                  <AppText variant="bodyStrong">{issue.title}</AppText>
                  {issue.description ? (
                    <AppText variant="bodySmall" tone="subtext">
                      {issue.description}
                    </AppText>
                  ) : null}
                </View>
              ) : null}

              <Pressable
                onPress={onShowAccessDetails}
                accessibilityRole="button"
                accessibilityLabel={`${accessLabel}. 사진 분석 안내 보기`}
                style={({ pressed }) => [
                  styles.accessBadge,
                  pressed && styles.controlPressed,
                ]}
              >
                <Sparkles color={colors.primary} size={spacing.sm} />
                <AppText variant="bodySmallStrong" style={styles.accessBadgeLabel}>
                  {accessLabel}
                </AppText>
                <Info color={colors.subtext} size={spacing.sm} />
              </Pressable>

              <View style={styles.controlPanel}>
                <AppText variant="bodySmall" tone="subtext">
                  무엇을 담고 있나요?
                </AppText>
                <View style={styles.sceneSelector}>
                  <SceneButton
                    icon={ReceiptText}
                    label="영수증"
                    selected={scene === "receipt"}
                    onPress={() => onSceneChange("receipt")}
                  />
                  <SceneButton
                    icon={Refrigerator}
                    label="냉장고"
                    selected={scene === "fridge"}
                    onPress={() => onSceneChange("fridge")}
                  />
                </View>

                <View style={styles.sourceActions}>
                  <Pressable
                    onPress={onOpenLibrary}
                    disabled={isBusy}
                    accessibilityRole="button"
                    accessibilityLabel="앨범에서 사진 고르기"
                    style={({ pressed }) => [
                      styles.sourceButton,
                      pressed && styles.controlPressed,
                      isBusy && styles.controlDisabled,
                    ]}
                  >
                    <ImageIcon color={colors.text} size={spacing.md} />
                    <AppText variant="caption">앨범</AppText>
                  </Pressable>
                  <Pressable
                    onPress={onCapture}
                    disabled={isBusy || !isCameraReady}
                    accessibilityRole="button"
                    accessibilityLabel={`${scene === "receipt" ? "영수증" : "냉장고"} 사진 촬영하기`}
                    style={({ pressed }) => [
                      styles.shutterButton,
                      pressed && styles.shutterButtonPressed,
                      (isBusy || !isCameraReady) && styles.controlDisabled,
                    ]}
                  >
                    {isBusy ? (
                      <ActivityIndicator color={colors.surface} />
                    ) : (
                      <Camera color={colors.surface} size={spacing.md} />
                    )}
                  </Pressable>
                  <View style={styles.actionSpacer} />
                </View>
                {!shouldUseCompactGuide ? (
                  <AppText variant="caption" tone="subtext" style={styles.sourceHint}>
                    앨범을 누르면 같은 종류의 저장된 사진을 가져와요.
                  </AppText>
                ) : null}
              </View>
            </ScrollView>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

function SceneButton({
  icon: Icon,
  label,
  selected,
  onPress,
}: {
  icon: typeof ReceiptText;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label} 사진`}
      style={({ pressed }) => [
        styles.sceneButton,
        selected && styles.sceneButtonSelected,
        pressed && styles.controlPressed,
      ]}
    >
      <Icon
        color={selected ? colors.primary : colors.subtext}
        size={spacing.sm}
        strokeWidth={2.3}
      />
      <AppText
        variant="bodySmallStrong"
        tone={selected ? "primary" : "subtext"}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.text,
  },
  captureBody: {
    flex: 1,
    minHeight: 0,
  },
  captureBodyLandscape: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: spacing.sm,
  },
  guideStage: {
    flex: 1,
    minHeight: 0,
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  guideStageLandscape: {
    minWidth: 0,
    paddingVertical: spacing.xxs,
  },
  guideCopy: {
    alignSelf: "center",
    maxWidth: 360,
    borderRadius: radius.xxl,
    backgroundColor: colors.cameraControl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xxs,
  },
  guideCopyLandscape: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  guideTitle: {
    textAlign: "center",
  },
  guideDescription: {
    textAlign: "center",
  },
  guideFrame: {
    position: "relative",
    minHeight: 180,
    flex: 1,
    maxHeight: 360,
    marginHorizontal: spacing.sm,
    borderRadius: radius.xxl,
  },
  guideFrameCompact: {
    minHeight: 120,
    maxHeight: 240,
  },
  guideFrameLandscape: {
    minHeight: spacing.xxxl + spacing.lg,
    maxHeight: spacing.xxxl + spacing.xxl,
  },
  corner: {
    position: "absolute",
    width: spacing.xl,
    height: spacing.xl,
    borderColor: colors.primary,
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: spacing.xxs,
    borderLeftWidth: spacing.xxs,
    borderTopLeftRadius: radius.lg,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: spacing.xxs,
    borderRightWidth: spacing.xxs,
    borderTopRightRadius: radius.lg,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: spacing.xxs,
    borderLeftWidth: spacing.xxs,
    borderBottomLeftRadius: radius.lg,
  },
  cornerBottomRight: {
    right: 0,
    bottom: 0,
    borderRightWidth: spacing.xxs,
    borderBottomWidth: spacing.xxs,
    borderBottomRightRadius: radius.lg,
  },
  bottomStack: {
    gap: spacing.xs,
  },
  bottomScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  bottomScrollLandscape: {
    flex: 1,
    maxWidth: 360,
  },
  bottomStackLandscape: {
    flexGrow: 1,
    justifyContent: "center",
    paddingBottom: spacing.xs,
  },
  issueCard: {
    borderRadius: radius.xxl,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    gap: spacing.xxs,
  },
  accessBadge: {
    minHeight: touchTarget.min,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    maxWidth: "100%",
    gap: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  accessBadgeLabel: {
    flexShrink: 1,
  },
  controlPanel: {
    borderRadius: radius.xxl,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  sceneSelector: {
    flexDirection: "row",
    borderRadius: radius.lg,
    backgroundColor: colors.mutedSurface,
    padding: spacing.xxs,
    gap: spacing.xxs,
  },
  sceneButton: {
    flex: 1,
    minHeight: touchTarget.min,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  sceneButtonSelected: {
    backgroundColor: colors.surface,
  },
  sourceActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sourceButton: {
    width: touchTarget.ctaLarge,
    minHeight: touchTarget.ctaLarge,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.mutedSurface,
  },
  shutterButton: {
    width: touchTarget.ctaLarge + spacing.sm,
    height: touchTarget.ctaLarge + spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: spacing.xxs,
    borderColor: colors.primarySoft,
    backgroundColor: colors.primary,
  },
  shutterButtonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  actionSpacer: {
    width: touchTarget.ctaLarge,
  },
  sourceHint: {
    textAlign: "center",
  },
  controlPressed: {
    opacity: 0.82,
  },
  controlDisabled: {
    opacity: 0.5,
  },
});
