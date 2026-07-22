import { BarcodeLookupSource, ExpirySource } from "@expirymate/shared";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import {
  Barcode,
  CalendarDays,
  CheckCircle2,
  Flashlight,
  Package,
  PenLine,
  RotateCcw,
  X,
} from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomSheet } from "../../components/BottomSheet";
import { Button } from "../../components/Button";
import { Mascot, type MascotMood } from "../../components/Mascot";
import { contributeBarcodeProduct } from "../../services/api";
import { colors, radius, spacing, touchTarget, typography } from "../../shared/theme";
import { useRegistrationStore } from "../../store/registration-store";
import { useProductScanner } from "./useProductScanner";

const SCAN_FRAME_HEIGHT = spacing.xxxl + spacing.xxxl + spacing.xl;
const SCAN_LINE_TRAVEL = SCAN_FRAME_HEIGHT - spacing.lg;

export function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const hasPermission = permission?.granted ?? false;
  const canRequestPermission = permission?.canAskAgain ?? true;

  return (
    <View style={styles.root}>
      {!hasPermission ? (
        <SafeAreaView style={styles.overlay}>
          <View style={styles.topBar}>
            <CloseButton onPress={() => router.back()} />
          </View>
          <PermissionCard
            canRequestPermission={canRequestPermission}
            onRequestPermission={() => {
              requestPermission().catch(() => null);
            }}
            isRequesting={permission == null}
          />
        </SafeAreaView>
      ) : (
        <ScannerCameraExperience />
      )}
    </View>
  );
}

function ScannerCameraExperience() {
  const scanner = useProductScanner();
  const setPrefill = useRegistrationStore((state) => state.setPrefill);
  const setDraft = useRegistrationStore((state) => state.setDraft);
  const [manualName, setManualName] = useState("");
  const [isContributing, setIsContributing] = useState(false);
  const [contributeError, setContributeError] = useState<string | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [showBarcodeSuccess, setShowBarcodeSuccess] = useState(false);
  const previousModeRef = useRef(scanner.mode);

  const needsManualName =
    scanner.productLookupStatus === "not-found" ||
    scanner.productLookupStatus === "error" ||
    (scanner.productLookupStatus === "success" && !scanner.product?.name);

  const resolvedProductName = needsManualName
    ? manualName.trim()
    : scanner.product?.name?.trim() ?? "";

  const resultMood: MascotMood = needsManualName ? "worry" : "happy";

  const productSourceLabel =
    scanner.productLookupStatus === "loading"
      ? "상품 정보를 찾고 있어요"
      : scanner.product?.source === BarcodeLookupSource.PRODUCT_MASTER
        ? "우리 목록에서 찾았어요"
        : scanner.product?.source === BarcodeLookupSource.OPEN_FOOD_FACTS
          ? "공개 상품 정보에서 찾았어요"
          : needsManualName
            ? "이름을 직접 알려주세요"
            : "상품 정보";

  const instructionTitle = showBarcodeSuccess
    ? "바코드를 읽었어요"
    : scanner.mode === "barcode"
      ? "바코드를 가운데에 맞춰 주세요"
      : "유통기한이 잘 보이게 비춰 주세요";

  const instructionDescription = showBarcodeSuccess
    ? "이제 같은 영역에 유통기한을 비춰 주세요."
    : scanner.mode === "barcode"
      ? "인식되면 이어서 유통기한도 확인할게요."
      : scanner.isOcrProcessing
        ? "날짜를 읽고 있어요. 조금만 기다려 주세요."
        : "날짜가 또렷하게 보이면 장고가 읽어볼게요.";

  useEffect(() => {
    const previousMode = previousModeRef.current;
    previousModeRef.current = scanner.mode;

    if (previousMode !== "barcode" || scanner.mode !== "ocr") {
      return undefined;
    }

    setShowBarcodeSuccess(true);
    const timeoutId = setTimeout(() => {
      setShowBarcodeSuccess(false);
    }, 700);

    return () => clearTimeout(timeoutId);
  }, [scanner.mode]);

  const handleUseScanResult = async () => {
    if (!scanner.confirmation || !resolvedProductName) {
      return;
    }

    setContributeError(null);

    if (needsManualName && scanner.confirmation.barcode) {
      setIsContributing(true);

      try {
        await contributeBarcodeProduct({
          barcode: scanner.confirmation.barcode,
          name: resolvedProductName,
          brand: scanner.product?.brand ?? undefined,
          category: scanner.product?.category ?? undefined,
        });
      } catch (error) {
        setContributeError(
          error instanceof Error
            ? error.message
            : "이름은 기억해 뒀지만, 공유 목록에는 아직 못 넣었어요.",
        );
      } finally {
        setIsContributing(false);
      }
    }

    setPrefill({
      displayName: resolvedProductName,
      brand: scanner.product?.brand ?? undefined,
    });
    setDraft({
      displayName: resolvedProductName,
      brand: scanner.product?.brand ?? undefined,
      expiryDate: scanner.confirmation.expirationDate,
      expirySource: ExpirySource.OCR_DETECTED,
    });
    // Clear confirmation so the Modal sheet dismisses; replace so scanner
    // unmounts and cannot keep overlaying /register.
    scanner.resetScanner();
    router.replace("/register");
  };

  const handleRescan = () => {
    setManualName("");
    setContributeError(null);
    setShowBarcodeSuccess(false);
    scanner.resetScanner();
  };

  const handleManualRegistration = () => {
    setPrefill(null);
    setDraft(null);
    scanner.resetScanner();
    router.replace("/register");
  };

  return (
    <>
      <CameraView
        ref={scanner.cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        active={scanner.isCameraActive}
        animateShutter={false}
        autofocus="off"
        enableTorch={torchEnabled && scanner.isCameraActive}
        barcodeScannerSettings={{
          barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"],
        }}
        onBarcodeScanned={
          scanner.mode === "barcode" ? scanner.handleBarcodeScanEvent : undefined
        }
        onCameraReady={scanner.handleCameraReady}
        onMountError={scanner.handleMountError}
      />

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.topBar}>
          <CloseButton onPress={() => router.back()} />
          <View
            style={styles.stepPill}
            accessible
            accessibilityLabel={
              scanner.mode === "barcode"
                ? "2단계 중 1단계, 바코드"
                : "2단계 중 2단계, 유통기한"
            }
          >
            <View style={styles.stepProgress}>
              <View style={[styles.stepSegment, styles.stepSegmentActive]} />
              <View
                style={[
                  styles.stepSegment,
                  scanner.mode !== "barcode" && styles.stepSegmentActive,
                ]}
              />
            </View>
            {scanner.mode === "barcode" ? (
              <Barcode color={colors.surface} size={spacing.sm} strokeWidth={2.4} />
            ) : (
              <CalendarDays color={colors.surface} size={spacing.sm} strokeWidth={2.4} />
            )}
            <Text style={styles.stepPillText}>
              {scanner.mode === "barcode" ? "1/2 바코드" : "2/2 유통기한"}
            </Text>
          </View>
        </View>

        {!scanner.isCameraReady ? (
          <View style={styles.centerStage}>
            <View style={styles.centerCard}>
              <Mascot size="small" mood="idle" />
              <Text style={styles.centerTitle}>카메라를 준비하고 있어요</Text>
              <Text style={styles.centerDescription}>
                장고가 렌즈를 닦는 중이에요. 조금만 기다려 주세요.
              </Text>
            </View>
          </View>
        ) : (
          <>
            <ScannerGuide showSuccess={showBarcodeSuccess} />

            <View style={styles.bottomStack}>
              {scanner.productLookupStatus === "loading" ? (
                <View style={styles.loadingStrip}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={styles.loadingText}>상품을 찾아보고 있어요</Text>
                </View>
              ) : null}

              {scanner.cameraErrorMessage ? (
                <InlineError message={scanner.cameraErrorMessage} />
              ) : null}

              {scanner.mode === "ocr" && scanner.ocrErrorMessage ? (
                <InlineError message={scanner.ocrErrorMessage} />
              ) : null}

              <View style={styles.cameraActions}>
                <Pressable
                  onPress={() => setTorchEnabled((current) => !current)}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: torchEnabled }}
                  accessibilityLabel={
                    torchEnabled ? "플래시 끌게요" : "플래시 켤게요"
                  }
                  style={({ pressed }) => [
                    styles.cameraAction,
                    torchEnabled && styles.cameraActionActive,
                    pressed &&
                      (torchEnabled
                        ? styles.cameraActionActivePressed
                        : styles.cameraActionPressed),
                  ]}
                >
                  <Flashlight
                    color={torchEnabled ? colors.text : colors.surface}
                    size={spacing.sm + spacing.xxs}
                    strokeWidth={2.4}
                  />
                  <Text
                    style={[
                      styles.cameraActionLabel,
                      torchEnabled && styles.cameraActionLabelActive,
                    ]}
                  >
                    {torchEnabled ? "플래시 켰어요" : "플래시 켤게요"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleManualRegistration}
                  accessibilityRole="button"
                  accessibilityLabel="바코드 없이 직접 입력할게요"
                  style={({ pressed }) => [
                    styles.cameraAction,
                    pressed && styles.cameraActionPressed,
                  ]}
                >
                  <PenLine
                    color={colors.surface}
                    size={spacing.sm + spacing.xxs}
                    strokeWidth={2.4}
                  />
                  <Text style={styles.cameraActionLabel}>직접 입력할게요</Text>
                </Pressable>
              </View>

              <View
                style={styles.instructionCard}
                accessibilityLiveRegion="polite"
              >
                <View style={styles.instructionIcon}>
                  {showBarcodeSuccess ? (
                    <CheckCircle2
                      color={colors.success}
                      size={spacing.md}
                      strokeWidth={2.4}
                    />
                  ) : scanner.mode === "barcode" ? (
                    <Barcode color={colors.primary} size={spacing.md} strokeWidth={2.4} />
                  ) : (
                    <CalendarDays
                      color={colors.primary}
                      size={spacing.md}
                      strokeWidth={2.4}
                    />
                  )}
                </View>
                <View style={styles.instructionCopy}>
                  <Text style={styles.instructionTitle}>{instructionTitle}</Text>
                  <Text style={styles.instructionDescription}>
                    {instructionDescription}
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}
      </SafeAreaView>

      <BottomSheet
        visible={Boolean(scanner.confirmation)}
        onClose={handleRescan}
        mascotMood={resultMood}
        title={
          needsManualName
            ? "이 재료 이름을 알려줄래요?"
            : "스캔 결과를 확인할까요?"
        }
        description={
          needsManualName
            ? "목록에서 못 찾았어요. 이름만 알려주시면 넣는 화면으로 이어갈게요."
            : "상품명과 유통기한을 넣기 화면에 채워 드릴게요."
        }
        footer={
          <View style={styles.sheetFooter}>
            <Button
              variant="secondary"
              icon={RotateCcw}
              onPress={handleRescan}
              disabled={isContributing}
              fullWidth
            >
              다시 스캔할게요
            </Button>
            <Button
              icon={CheckCircle2}
              iconPosition="right"
              onPress={() => {
                void handleUseScanResult();
              }}
              disabled={
                !resolvedProductName ||
                isContributing ||
                scanner.productLookupStatus === "loading"
              }
              loading={isContributing || scanner.productLookupStatus === "loading"}
              fullWidth
            >
              넣으러 갈게요
            </Button>
          </View>
        }
      >
        {scanner.confirmation ? (
          <>
            <View style={styles.productRow}>
              {scanner.product?.imageUrl ? (
                <Image
                  source={{ uri: scanner.product.imageUrl }}
                  style={styles.productImage}
                  accessibilityLabel={`${scanner.product?.name ?? "상품"} 이미지`}
                />
              ) : (
                <View style={styles.productImageFallback}>
                  <Package color={colors.primary} size={spacing.md} strokeWidth={2.4} />
                </View>
              )}
              <View style={styles.productCopy}>
                <Text style={styles.productEyebrow}>{productSourceLabel}</Text>
                <Text style={styles.productName}>
                  {needsManualName
                    ? "아직 이름이 없어요"
                    : scanner.product?.name ?? "상품명을 찾고 있어요"}
                </Text>
                <Text style={styles.productBarcode}>
                  바코드 {scanner.confirmation.barcode}
                </Text>
              </View>
            </View>

            {needsManualName ? (
              <View style={styles.manualNameCard}>
                <Text style={styles.manualNameLabel}>이 재료 이름이 뭐예요?</Text>
                <TextInput
                  value={manualName}
                  onChangeText={setManualName}
                  accessibilityLabel="재료 이름"
                  placeholder="예: 서울우유 1L"
                  placeholderTextColor={colors.mutedText}
                  style={styles.manualNameInput}
                  autoCorrect={false}
                  returnKeyType="done"
                />
                <Text style={styles.manualNameHint}>
                  알려주시면 다음에도 바로 불러올 수 있어요.
                </Text>
              </View>
            ) : null}

            <View style={styles.expiryCard}>
              <Text style={styles.expiryLabel}>읽은 유통기한</Text>
              <Text style={styles.expiryValue}>
                {scanner.confirmation.expirationDate}
              </Text>
            </View>

            {scanner.productErrorMessage ? (
              <Text style={styles.sheetFootnote}>
                상품 조회는 잠시 막혔지만, 이름을 직접 적으면 넣을 수 있어요.
              </Text>
            ) : null}

            {contributeError ? (
              <Text style={styles.sheetFootnote}>{contributeError}</Text>
            ) : null}
          </>
        ) : null}
      </BottomSheet>
    </>
  );
}

function ScannerGuide({ showSuccess }: { showSuccess: boolean }) {
  const reduceMotion = useReducedMotion();
  const scanLineOffset = useSharedValue<number>(spacing.none);

  useEffect(() => {
    cancelAnimation(scanLineOffset);

    if (reduceMotion || showSuccess) {
      scanLineOffset.value = spacing.none;
      return undefined;
    }

    scanLineOffset.value = spacing.none;
    scanLineOffset.value = withRepeat(
      withTiming(SCAN_LINE_TRAVEL, {
        duration: 1600,
        easing: Easing.inOut(Easing.cubic),
      }),
      -1,
      true,
    );

    return () => cancelAnimation(scanLineOffset);
  }, [reduceMotion, scanLineOffset, showSuccess]);

  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanLineOffset.value }],
  }));

  return (
    <View style={styles.guideArea} pointerEvents="none">
      <View style={styles.guideScrim} />
      <View style={styles.guideMiddle}>
        <View style={styles.guideSideScrim} />
        <View style={styles.scanFrame}>
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
          ) : reduceMotion ? (
            <View style={styles.scanLine} />
          ) : (
            <Animated.View
              style={[styles.scanLine, styles.scanLineAnimated, scanLineStyle]}
            />
          )}
        </View>
        <View style={styles.guideSideScrim} />
      </View>
      <View style={styles.guideScrim} />
    </View>
  );
}

function CloseButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="스캐너를 닫을게요"
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

function PermissionCard({
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
        <Mascot size="medium" mood="worry" />
        <Text style={styles.centerTitle}>카메라가 필요해요</Text>
        <Text style={styles.centerDescription}>
          바코드를 읽으려면 카메라 권한을 허용해 주세요. 장고가 대신 봐 드릴게요.
        </Text>
        {canRequestPermission || isRequesting ? (
          <Button onPress={onRequestPermission} disabled={isRequesting} fullWidth>
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
      </View>
    </View>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <View style={styles.errorStrip}>
      <Mascot size="small" mood="worry" />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.text,
  },
  overlay: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing.sm,
  },
  iconButton: {
    width: touchTarget.min,
    height: touchTarget.min,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cameraControl,
  },
  iconButtonPressed: {
    backgroundColor: colors.cameraControlPressed,
  },
  stepPill: {
    minHeight: touchTarget.min,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.cameraControl,
  },
  stepProgress: {
    flexDirection: "row",
    gap: spacing.xxs,
  },
  stepSegment: {
    width: spacing.sm,
    height: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.mutedText,
  },
  stepSegmentActive: {
    backgroundColor: colors.primary,
  },
  stepPillText: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.surface,
  },
  guideArea: {
    flex: 1,
    alignItems: "stretch",
  },
  guideScrim: {
    flex: 1,
    backgroundColor: colors.cameraScrim,
  },
  guideMiddle: {
    height: SCAN_FRAME_HEIGHT,
    flexDirection: "row",
  },
  guideSideScrim: {
    width: spacing.lg,
    backgroundColor: colors.cameraScrim,
  },
  scanFrame: {
    flex: 1,
    height: SCAN_FRAME_HEIGHT,
    borderWidth: 1,
    borderColor: colors.surface,
    borderRadius: radius.xxl,
    overflow: "hidden",
  },
  scanLine: {
    position: "absolute",
    top: spacing.sm,
    left: spacing.md,
    right: spacing.md,
    height: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  scanLineAnimated: {
    opacity: 0.9,
  },
  scanSuccess: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cameraScrim,
  },
  corner: {
    position: "absolute",
    width: spacing.lg,
    height: spacing.lg,
    borderColor: colors.primary,
    zIndex: 1,
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
    gap: spacing.sm,
  },
  cameraActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  cameraAction: {
    flex: 1,
    minHeight: touchTarget.min,
    borderRadius: radius.pill,
    backgroundColor: colors.cameraControl,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  cameraActionActive: {
    backgroundColor: colors.primarySoft,
  },
  cameraActionActivePressed: {
    backgroundColor: colors.primarySoftPressed,
  },
  cameraActionPressed: {
    backgroundColor: colors.cameraControlPressed,
  },
  cameraActionLabel: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.surface,
  },
  cameraActionLabelActive: {
    color: colors.text,
  },
  loadingStrip: {
    minHeight: touchTarget.min,
    borderRadius: radius.xxl,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  instructionCard: {
    borderRadius: radius.xxl,
    backgroundColor: colors.surface,
    padding: spacing.md,
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  instructionIcon: {
    width: spacing.xl,
    height: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  instructionCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  instructionTitle: {
    fontSize: typography.subheading.fontSize,
    lineHeight: typography.subheading.lineHeight,
    fontFamily: typography.subheading.fontFamily,
    color: colors.text,
  },
  instructionDescription: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.subtext,
  },
  errorStrip: {
    borderRadius: radius.xxl,
    backgroundColor: colors.dangerSoft,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: touchTarget.min,
  },
  errorText: {
    flex: 1,
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.danger,
  },
  centerStage: {
    flex: 1,
    justifyContent: "center",
    alignItems: "stretch",
  },
  centerCard: {
    alignSelf: "stretch",
    borderRadius: radius.xxl,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
    alignItems: "center",
  },
  centerTitle: {
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
    fontFamily: typography.heading.fontFamily,
    color: colors.text,
    textAlign: "center",
  },
  centerDescription: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.subtext,
    textAlign: "center",
  },
  sheetFooter: {
    gap: spacing.sm,
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.xxl,
    backgroundColor: colors.mutedSurface,
    padding: spacing.md,
  },
  productImage: {
    width: spacing.xxxl,
    height: spacing.xxxl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  productImageFallback: {
    width: spacing.xxxl,
    height: spacing.xxxl,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  productCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  productEyebrow: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.primary,
  },
  productName: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.text,
  },
  productBarcode: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.subtext,
  },
  manualNameCard: {
    borderRadius: radius.xxl,
    backgroundColor: colors.mutedSurface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  manualNameLabel: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.text,
  },
  manualNameInput: {
    minHeight: touchTarget.cta,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: typography.body.fontSize,
    fontFamily: typography.bodyStrong.fontFamily,
  },
  manualNameHint: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.subtext,
  },
  expiryCard: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xxs,
  },
  expiryLabel: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.subtext,
  },
  expiryValue: {
    fontSize: typography.title.fontSize,
    lineHeight: typography.title.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.text,
  },
  sheetFootnote: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.subtext,
  },
});
