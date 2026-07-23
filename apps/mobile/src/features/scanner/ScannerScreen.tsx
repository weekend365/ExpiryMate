import {
  addDays,
  BarcodeLookupSource,
  ExpirySource,
  formatDateKorean,
  isDateOnlyString,
  toIsoDate,
} from "@expirymate/shared";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
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
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomSheet } from "../../components/BottomSheet";
import { Button } from "../../components/Button";
import { type MascotMood } from "../../components/Mascot";
import { MascotSpeechBubble } from "../../components/MascotSpeechBubble";
import { Pill } from "../../components/Pill";
import { contributeBarcodeProduct } from "../../services/api";
import { colors, radius, spacing, touchTarget, typography } from "../../shared/theme";
import { useRegistrationStore } from "../../store/registration-store";
import {
  SCAN_FRAME_HEIGHT,
  SCAN_FRAME_SIDE_INSET,
  SCAN_LINE_HEIGHT,
  SCAN_LINE_INSET,
  SCAN_LINE_TRAVEL,
} from "./scanGuide";
import { useProductScanner } from "./useProductScanner";

const QUICK_EXPIRY_OPTIONS = [
  { label: "오늘", days: 0 },
  { label: "내일", days: 1 },
  { label: "3일 뒤", days: 3 },
  { label: "일주일", days: 7 },
];

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
  const [manualExpiryDate, setManualExpiryDate] = useState("");
  const [manualExpirySource, setManualExpirySource] = useState<ExpirySource>(
    ExpirySource.MANUAL,
  );
  const [isContributing, setIsContributing] = useState(false);
  const [contributeError, setContributeError] = useState<string | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [showBarcodeSuccess, setShowBarcodeSuccess] = useState(false);
  const previousModeRef = useRef(scanner.mode);

  const needsManualName =
    scanner.productLookupStatus === "not-found" ||
    scanner.productLookupStatus === "error" ||
    (scanner.productLookupStatus === "success" && !scanner.product?.name);

  const needsManualExpiry = scanner.confirmation?.expirationDate == null;
  const resolvedExpiryDate = needsManualExpiry
    ? manualExpiryDate
    : (scanner.confirmation?.expirationDate ?? "");
  const resolvedExpirySource = needsManualExpiry
    ? manualExpirySource
    : ExpirySource.OCR_DETECTED;

  const resolvedProductName = needsManualName
    ? manualName.trim()
    : scanner.product?.name?.trim() ?? "";

  const resultMood: MascotMood =
    needsManualName || needsManualExpiry ? "worry" : "happy";

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

  const guideMood: Extract<MascotMood, "speak" | "think"> =
    scanner.mode === "ocr" && scanner.isOcrProcessing && !showBarcodeSuccess
      ? "think"
      : "speak";

  const guideMessage = showBarcodeSuccess
    ? "바코드를 읽었어요. 이제 유통기한을 같은 곳에 비춰 주세요."
    : scanner.mode === "barcode"
      ? "바코드를 가운데에 맞춰 주세요. 인식되면 유통기한도 이어서 볼게요."
      : scanner.isOcrProcessing
        ? "날짜를 읽고 있어요. 조금만 기다려 주세요."
        : "유통기한이 잘 보이게 비춰 주세요. 또렷하면 장고가 읽어볼게요.";

  const hasInlineScanError = Boolean(
    scanner.cameraErrorMessage ||
      (scanner.mode === "ocr" && scanner.ocrErrorMessage),
  );

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

  useEffect(() => {
    if (!scanner.confirmation) {
      setManualExpiryDate("");
      setManualExpirySource(ExpirySource.MANUAL);
    }
  }, [scanner.confirmation]);

  const handleUseScanResult = async () => {
    if (!scanner.confirmation || !resolvedProductName || !resolvedExpiryDate) {
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
      expiryDate: resolvedExpiryDate,
      expirySource: resolvedExpirySource,
    });
    // Clear confirmation so the Modal sheet dismisses; replace so scanner
    // unmounts and cannot keep overlaying /register.
    scanner.resetScanner();
    router.replace("/register");
  };

  const handleRescan = () => {
    setManualName("");
    setManualExpiryDate("");
    setManualExpirySource(ExpirySource.MANUAL);
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

  const handlePresetExpiry = (days: number) => {
    setManualExpiryDate(toIsoDate(addDays(new Date(), days)));
    setManualExpirySource(ExpirySource.PRESET);
  };

  const handleManualExpiryChange = (nextDate: string) => {
    setManualExpiryDate(nextDate);
    setManualExpirySource(ExpirySource.MANUAL);
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
              <Text style={styles.centerTitle}>카메라를 준비하고 있어요</Text>
              <MascotSpeechBubble
                message="장고가 렌즈를 닦는 중이에요. 조금만 기다려 주세요."
                mood="idle"
                size="small"
                style={styles.centerBubble}
              />
            </View>
          </View>
        ) : (
          <>
            <ScannerGuide
              showSuccess={showBarcodeSuccess}
              guideMessage={hasInlineScanError ? null : guideMessage}
              guideMood={guideMood}
              onGuideFrameChange={scanner.setGuideFrame}
            />

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
                    styles.flashButton,
                    torchEnabled && styles.flashButtonActive,
                    pressed &&
                      (torchEnabled
                        ? styles.flashButtonActivePressed
                        : styles.flashButtonPressed),
                  ]}
                >
                  <Flashlight
                    color={torchEnabled ? colors.text : colors.surface}
                    size={spacing.sm + spacing.xxs}
                    strokeWidth={2.4}
                  />
                </Pressable>
                {scanner.mode === "ocr" ? (
                  <Pressable
                    onPress={scanner.confirmWithManualExpiry}
                    accessibilityRole="button"
                    accessibilityLabel="유통기한이 안 보여서 직접 고를게요"
                    style={({ pressed }) => [
                      styles.manualAction,
                      pressed && styles.manualActionPressed,
                    ]}
                  >
                    <CalendarDays
                      color={colors.surface}
                      size={spacing.sm + spacing.xxs}
                      strokeWidth={2.4}
                    />
                    <Text style={styles.manualActionLabel}>
                      유통기한이 안 보여요
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={handleManualRegistration}
                    accessibilityRole="button"
                    accessibilityLabel="바코드 없이 직접 입력할게요"
                    style={({ pressed }) => [
                      styles.manualAction,
                      pressed && styles.manualActionPressed,
                    ]}
                  >
                    <PenLine
                      color={colors.surface}
                      size={spacing.sm + spacing.xxs}
                      strokeWidth={2.4}
                    />
                    <Text style={styles.manualActionLabel}>직접 입력할게요</Text>
                  </Pressable>
                )}
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
            : needsManualExpiry
              ? "유통기한은 언제까지인가요?"
              : "스캔 결과를 확인할까요?"
        }
        description={
          needsManualName && needsManualExpiry
            ? "목록에서 못 찾았어요. 이름과 유통기한을 알려주시면 이어서 넣을게요."
            : needsManualExpiry
              ? "날짜가 안 보여도 괜찮아요. 직접 골라 주시면 이어서 넣을게요."
              : needsManualName
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
                !resolvedExpiryDate ||
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

            {needsManualExpiry ? (
              <ManualExpirySection
                expiryDate={manualExpiryDate}
                expirySource={manualExpirySource}
                onPreset={handlePresetExpiry}
                onManualChange={handleManualExpiryChange}
              />
            ) : (
              <View style={styles.expiryCard}>
                <Text style={styles.expiryLabel}>읽은 유통기한</Text>
                <Text style={styles.expiryValue}>
                  {scanner.confirmation.expirationDate}
                </Text>
              </View>
            )}

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

function ScannerGuide({
  showSuccess,
  guideMessage,
  guideMood = "speak",
  onGuideFrameChange,
}: {
  showSuccess: boolean;
  guideMessage: string | null;
  guideMood?: Extract<MascotMood, "speak" | "think">;
  onGuideFrameChange: (frame: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null) => void;
}) {
  const reduceMotion = useReducedMotion();
  const scanLineProgress = useSharedValue(0);
  const frameRef = useRef<View>(null);

  useEffect(() => {
    cancelAnimation(scanLineProgress);

    if (reduceMotion || showSuccess) {
      scanLineProgress.value = 0;
      return undefined;
    }

    scanLineProgress.value = 0;
    scanLineProgress.value = withRepeat(
      withTiming(1, {
        duration: 1800,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      true,
    );

    return () => cancelAnimation(scanLineProgress);
  }, [reduceMotion, scanLineProgress, showSuccess]);

  const scanLineStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      scanLineProgress.value,
      [0, 1],
      [0, SCAN_LINE_TRAVEL],
    );
    const opacity = interpolate(
      scanLineProgress.value,
      [0, 0.15, 0.85, 1],
      [0.35, 1, 1, 0.35],
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
    <View style={styles.guideStage} pointerEvents="box-none">
      <View style={styles.guideCluster} pointerEvents="box-none">
        {guideMessage ? (
          <View style={styles.guideBubbleWrap} pointerEvents="none">
            <MascotSpeechBubble
              message={guideMessage}
              mood={guideMood}
              size="small"
            />
          </View>
        ) : null}
        <View style={styles.guideArea} pointerEvents="none">
          <View
            ref={frameRef}
            style={styles.scanFrame}
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
            ) : reduceMotion ? (
              <View style={[styles.scanLine, styles.scanLineStatic]} />
            ) : (
              <Animated.View style={[styles.scanLine, scanLineStyle]}>
                <View style={styles.scanLineCore} />
              </Animated.View>
            )}
          </View>
        </View>
      </View>
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
        <Text style={styles.centerTitle}>카메라가 필요해요</Text>
        <MascotSpeechBubble
          message="바코드를 읽으려면 카메라 권한을 허용해 주세요. 장고가 대신 봐 드릴게요."
          mood="worry"
          size="small"
          style={styles.centerBubble}
        />
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
    <View style={styles.errorStrip} accessibilityLiveRegion="polite">
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

function ManualExpirySection({
  expiryDate,
  expirySource,
  onPreset,
  onManualChange,
}: {
  expiryDate: string;
  expirySource: ExpirySource;
  onPreset: (days: number) => void;
  onManualChange: (value: string) => void;
}) {
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  const [draftDate, setDraftDate] = useState<Date>(
    expiryDate ? toDatePickerDate(expiryDate) : new Date(),
  );
  const didSeedDefaultRef = useRef(false);

  useEffect(() => {
    setDraftDate(expiryDate ? toDatePickerDate(expiryDate) : new Date());
  }, [expiryDate]);

  // iOS spinner shows today visually; seed the same value so CTA stays in sync.
  useEffect(() => {
    if (Platform.OS !== "ios" || expiryDate || didSeedDefaultRef.current) {
      return;
    }

    didSeedDefaultRef.current = true;
    onManualChange(toDatePickerDateOnly(new Date()));
  }, [expiryDate, onManualChange]);

  const handleInlineChange = (
    _event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    if (!selectedDate) {
      return;
    }

    setDraftDate(selectedDate);
    onManualChange(toDatePickerDateOnly(selectedDate));
  };

  const handleAndroidChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    setShowAndroidPicker(false);

    if (event.type === "dismissed" || !selectedDate) {
      return;
    }

    onManualChange(toDatePickerDateOnly(selectedDate));
  };

  const displayValue = expiryDate
    ? formatDateKorean(expiryDate)
    : "날짜를 골라 주세요";

  return (
    <View style={styles.manualExpiryCard}>
      <Text style={styles.manualExpiryLabel}>유통기한은 언제까지인가요?</Text>
      <View style={styles.pillRow}>
        {QUICK_EXPIRY_OPTIONS.map((option) => {
          const presetDate = toIsoDate(addDays(new Date(), option.days));

          return (
            <Pill
              key={option.days}
              label={option.label}
              icon={CalendarDays}
              selected={
                expiryDate === presetDate && expirySource === ExpirySource.PRESET
              }
              onPress={() => onPreset(option.days)}
            />
          );
        })}
      </View>

      {Platform.OS === "ios" ? (
        <View style={styles.inlinePickerWrap}>
          <DateTimePicker
            value={draftDate}
            mode="date"
            display="spinner"
            themeVariant="light"
            accentColor={colors.primary}
            locale="ko-KR"
            onChange={handleInlineChange}
            style={styles.inlinePicker}
          />
        </View>
      ) : (
        <>
          <Pressable
            onPress={() => setShowAndroidPicker(true)}
            accessibilityRole="button"
            accessibilityLabel={`유통기한, ${displayValue}`}
            accessibilityHint="날짜를 직접 고를 수 있어요"
            style={({ pressed }) => [
              styles.androidDateTrigger,
              pressed && styles.androidDateTriggerPressed,
            ]}
          >
            <Text
              style={
                expiryDate
                  ? styles.androidDateValue
                  : styles.androidDatePlaceholder
              }
            >
              {displayValue}
            </Text>
            <Text style={styles.androidDateAction}>직접 고르기</Text>
          </Pressable>
          {showAndroidPicker ? (
            <DateTimePicker
              value={expiryDate ? toDatePickerDate(expiryDate) : new Date()}
              mode="date"
              display="default"
              onChange={handleAndroidChange}
            />
          ) : null}
        </>
      )}
    </View>
  );
}

function toDatePickerDate(value: string) {
  if (!isDateOnlyString(value)) {
    return new Date(value);
  }

  const [yearText, monthText, dayText] = value.split("-");
  return new Date(Number(yearText), Number(monthText) - 1, Number(dayText));
}

function toDatePickerDateOnly(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
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
    textShadowColor: colors.cameraControl,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  guideStage: {
    flex: 1,
    justifyContent: "center",
  },
  guideCluster: {
    position: "relative",
    width: "100%",
  },
  guideBubbleWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: "100%",
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xxs,
  },
  guideArea: {
    paddingHorizontal: SCAN_FRAME_SIDE_INSET - spacing.md,
  },
  scanFrame: {
    height: SCAN_FRAME_HEIGHT,
    borderRadius: radius.xxl,
    overflow: "hidden",
  },
  scanLine: {
    position: "absolute",
    top: SCAN_LINE_INSET,
    left: spacing.md,
    right: spacing.md,
    height: SCAN_LINE_HEIGHT + spacing.xxs,
    alignItems: "center",
    justifyContent: "center",
  },
  scanLineStatic: {
    top: SCAN_FRAME_HEIGHT / 2 - SCAN_LINE_HEIGHT,
  },
  scanLineCore: {
    width: "100%",
    height: SCAN_LINE_HEIGHT,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: spacing.xs,
  },
  scanSuccess: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cameraScrim,
  },
  corner: {
    position: "absolute",
    width: spacing.xl,
    height: spacing.xl,
    borderColor: colors.primary,
    zIndex: 1,
  },
  cornerTopLeft: {
    top: spacing.xs,
    left: spacing.xs,
    borderTopWidth: spacing.xxs,
    borderLeftWidth: spacing.xxs,
    borderTopLeftRadius: radius.lg,
  },
  cornerTopRight: {
    top: spacing.xs,
    right: spacing.xs,
    borderTopWidth: spacing.xxs,
    borderRightWidth: spacing.xxs,
    borderTopRightRadius: radius.lg,
  },
  cornerBottomLeft: {
    bottom: spacing.xs,
    left: spacing.xs,
    borderBottomWidth: spacing.xxs,
    borderLeftWidth: spacing.xxs,
    borderBottomLeftRadius: radius.lg,
  },
  cornerBottomRight: {
    right: spacing.xs,
    bottom: spacing.xs,
    borderRightWidth: spacing.xxs,
    borderBottomWidth: spacing.xxs,
    borderBottomRightRadius: radius.lg,
  },
  bottomStack: {
    gap: spacing.sm,
  },
  cameraActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  flashButton: {
    width: touchTarget.min,
    height: touchTarget.min,
    borderRadius: radius.pill,
    backgroundColor: colors.cameraControl,
    alignItems: "center",
    justifyContent: "center",
  },
  flashButtonActive: {
    backgroundColor: colors.primarySoft,
  },
  flashButtonActivePressed: {
    backgroundColor: colors.primarySoftPressed,
  },
  flashButtonPressed: {
    backgroundColor: colors.cameraControlPressed,
  },
  manualAction: {
    flex: 1,
    minHeight: touchTarget.min,
    borderRadius: radius.pill,
    backgroundColor: colors.cameraControl,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  manualActionPressed: {
    backgroundColor: colors.cameraControlPressed,
  },
  manualActionLabel: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.surface,
    textShadowColor: colors.cameraControl,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
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
    alignItems: "stretch",
  },
  centerTitle: {
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
    fontFamily: typography.heading.fontFamily,
    color: colors.text,
    textAlign: "center",
  },
  centerBubble: {
    alignSelf: "stretch",
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
  manualExpiryCard: {
    borderRadius: radius.xxl,
    backgroundColor: colors.mutedSurface,
    padding: spacing.md,
    gap: spacing.md,
  },
  manualExpiryLabel: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.text,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  inlinePickerWrap: {
    alignItems: "center",
    width: "100%",
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  inlinePicker: {
    alignSelf: "center",
    width: "100%",
  },
  androidDateTrigger: {
    minHeight: touchTarget.cta,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    justifyContent: "space-between",
    gap: spacing.xs,
  },
  androidDateTriggerPressed: {
    backgroundColor: colors.surfacePressed,
  },
  androidDateValue: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  androidDatePlaceholder: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.body.fontFamily,
    color: colors.mutedText,
  },
  androidDateAction: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    color: colors.primary,
    fontFamily: typography.label.fontFamily,
  },
  sheetFootnote: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.subtext,
  },
});
