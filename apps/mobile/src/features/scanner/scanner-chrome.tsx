import { CheckCircle2, X } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { Linking, Pressable, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { AppText } from "../../components/AppText";
import { Button } from "../../components/Button";
import { type MascotMood } from "../../components/Mascot";
import { MascotSpeechBubble } from "../../components/MascotSpeechBubble";
import { colors, spacing } from "../../shared/theme";
import { useResponsiveLayout } from "../../shared/responsive-layout";
import { getScanFrameHeight, getScanLineTravel } from "./scanGuide";
import { scannerScreenStyles as styles } from "./scanner-screen-styles";

export function ScannerGuide({
  showSuccess,
  guideMessage,
  guideMood = "speak",
  compactHeight = false,
  onGuideFrameChange,
}: {
  showSuccess: boolean;
  guideMessage: string | null;
  guideMood?: Extract<MascotMood, "speak" | "think">;
  compactHeight?: boolean;
  onGuideFrameChange: (frame: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null) => void;
}) {
  const { height: windowHeight } = useResponsiveLayout();
  const frameHeight = getScanFrameHeight(windowHeight, compactHeight);
  const scanLineTravel = getScanLineTravel(frameHeight);
  const scanLineProgress = useSharedValue(0);
  const scanLineTravelSV = useSharedValue(scanLineTravel);
  scanLineTravelSV.value = scanLineTravel;
  const frameRef = useRef<View>(null);

  useEffect(() => {
    cancelAnimation(scanLineProgress);

    if (showSuccess) {
      scanLineProgress.value = 0;
      return undefined;
    }

    scanLineProgress.value = 0;
    scanLineProgress.value = withRepeat(
      withTiming(1, {
        duration: 1800,
        easing: Easing.inOut(Easing.quad),
        reduceMotion: ReduceMotion.System,
      }),
      -1,
      true,
      undefined,
      ReduceMotion.System,
    );

    return () => cancelAnimation(scanLineProgress);
  }, [scanLineProgress, showSuccess]);

  const scanLineStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      scanLineProgress.value,
      [0, 1],
      [0, scanLineTravelSV.value],
    );
    const opacity = interpolate(
      scanLineProgress.value,
      [0, 0.12, 0.88, 1],
      [0.7, 1, 1, 0.7],
    );

    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  const handleFrameLayout = () => {
    frameRef.current?.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) {
        onGuideFrameChange(null);
        return;
      }

      onGuideFrameChange({ x, y, width, height });
    });
  };

  return (
    <View
      style={[styles.guideStage, compactHeight && styles.guideStageCompact]}
      pointerEvents="box-none"
    >
      <View
        style={[styles.guideCluster, compactHeight && styles.guideClusterCompact]}
        pointerEvents="box-none"
      >
        {guideMessage ? (
          compactHeight ? (
            <View style={styles.guideMessageCompact} pointerEvents="none">
              <AppText
                variant="bodySmall"
                tone="inverse"
                style={styles.guideMessageCompactText}
              >
                {guideMessage}
              </AppText>
            </View>
          ) : (
            <View style={styles.guideBubbleWrap} pointerEvents="none">
              <MascotSpeechBubble
                message={guideMessage}
                mood={guideMood}
                size="small"
              />
            </View>
          )
        ) : null}
        <View style={styles.guideArea} pointerEvents="none">
          <View
            ref={frameRef}
            collapsable={false}
            style={[styles.scanFrame, { height: frameHeight }]}
            onLayout={handleFrameLayout}
          >
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />
            {showSuccess ? (
              <View style={styles.scanSuccess}>
                <CheckCircle2
                  color={colors.surface}
                  size={spacing.xl}
                  strokeWidth={2.5}
                />
              </View>
            ) : (
              <Animated.View
                collapsable={false}
                style={[styles.scanLine, scanLineStyle]}
              />
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

export function CloseButton({
  onPress,
  accessibilityLabel = "스캐너 닫기",
}: {
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={spacing.xs}
      style={({ pressed }) => [
        styles.iconButton,
        pressed && styles.iconButtonPressed,
      ]}
    >
      <X color={colors.surface} size={spacing.md} strokeWidth={2.4} />
    </Pressable>
  );
}

export function PermissionCard({
  canRequestPermission,
  onRequestPermission,
  isRequesting = false,
}: {
  canRequestPermission: boolean;
  onRequestPermission: () => void;
  isRequesting?: boolean;
}) {
  return (
    <View style={styles.centerStage}>
      <View style={styles.centerCard}>
        <AppText style={styles.centerTitle}>카메라가 필요해요</AppText>
        <MascotSpeechBubble
          message="바코드를 읽으려면 카메라 권한을 허용해 주세요. 장고가 대신 봐 드릴게요."
          mood="worry"
          size="small"
          style={styles.centerBubble}
        />
        {canRequestPermission || isRequesting ? (
          <Button onPress={onRequestPermission} disabled={isRequesting} fullWidth>
            카메라 켜기
          </Button>
        ) : (
          <Button
            onPress={() => {
              void Linking.openSettings();
            }}
            fullWidth
          >
            설정 열기
          </Button>
        )}
      </View>
    </View>
  );
}

export function InlineError({ message }: { message: string }) {
  return (
    <View style={styles.errorStrip} accessibilityLiveRegion="polite">
      <AppText style={styles.errorText}>{message}</AppText>
    </View>
  );
}
