import { BarcodeLookupSource, ExpirySource } from "@expirymate/shared";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import {
  Barcode,
  CalendarDays,
  CheckCircle2,
  Package,
  RotateCcw,
  X,
} from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomSheet } from "../../components/BottomSheet";
import { Button } from "../../components/Button";
import { Mascot, type MascotMood } from "../../components/Mascot";
import { contributeBarcodeProduct } from "../../services/api";
import { colors, radius, spacing, touchTarget, typography } from "../../shared/theme";
import { useRegistrationStore } from "../../store/registration-store";
import { useProductScanner } from "./useProductScanner";

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

  const instructionTitle =
    scanner.mode === "barcode"
      ? "바코드를 가운데에 맞춰 주세요"
      : "유통기한이 잘 보이게 비춰 주세요";

  const instructionDescription =
    scanner.mode === "barcode"
      ? "인식되면 이어서 유통기한도 확인할게요."
      : scanner.isOcrProcessing
        ? "날짜를 읽고 있어요. 조금만 기다려 주세요."
        : "날짜가 또렷하게 보이면 장고가 읽어볼게요.";

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
            : "이름은 저장했지만, 공유 목록에는 아직 못 넣었어요.",
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
    router.push("/register");
  };

  const handleRescan = () => {
    setManualName("");
    setContributeError(null);
    scanner.resetScanner();
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
          <View style={styles.stepPill}>
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
          <View style={styles.centerCard}>
            <Mascot size="small" mood="idle" />
            <Text style={styles.centerTitle}>카메라를 준비하고 있어요</Text>
            <Text style={styles.centerDescription}>
              장고가 렌즈를 닦는 중이에요. 조금만 기다려 주세요.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.guideArea} pointerEvents="none">
              <View
                style={[
                  styles.roiBox,
                  scanner.mode === "ocr" ? styles.ocrRoiBox : styles.barcodeRoiBox,
                ]}
              >
                <View style={[styles.corner, styles.cornerTopLeft]} />
                <View style={[styles.corner, styles.cornerTopRight]} />
                <View style={[styles.corner, styles.cornerBottomLeft]} />
                <View style={[styles.corner, styles.cornerBottomRight]} />
              </View>
            </View>

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

              <View style={styles.instructionCard}>
                <View style={styles.instructionIcon}>
                  {scanner.mode === "barcode" ? (
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
            ? "목록에서 못 찾았어요. 이름만 알려주시면 등록으로 이어갈게요."
            : "상품명과 유통기한을 등록 화면에 채워 드릴게요."
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
              등록하러 갈게요
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
                    : scanner.product?.name ?? "상품명 확인 중"}
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
                상품 조회는 잠시 막혔지만, 이름을 직접 적으면 등록할 수 있어요.
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

function CloseButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="스캐너 닫기"
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
    <View style={styles.centerCard}>
      <Mascot size="medium" mood="worry" />
      <Text style={styles.centerTitle}>카메라가 필요해요</Text>
      <Text style={styles.centerDescription}>
        바코드를 읽으려면 카메라 권한을 허용해 주세요. 장고가 대신 봐 드릴게요.
      </Text>
      <Button
        onPress={onRequestPermission}
        disabled={!canRequestPermission && !isRequesting}
        fullWidth
      >
        카메라 켤게요
      </Button>
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
    backgroundColor: colors.text,
    opacity: 0.72,
  },
  iconButtonPressed: {
    opacity: 0.9,
  },
  stepPill: {
    minHeight: touchTarget.min,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.text,
    opacity: 0.72,
  },
  stepPillText: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontWeight: typography.title.fontWeight,
    color: colors.surface,
  },
  guideArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  roiBox: {
    borderWidth: 1,
    borderColor: colors.surface,
  },
  barcodeRoiBox: {
    width: "86%",
    height: spacing.xxxl + spacing.xxxl + spacing.xl,
    borderRadius: radius.xxl,
  },
  ocrRoiBox: {
    width: "88%",
    height: spacing.xxxl + spacing.xl,
    borderRadius: radius.lg,
  },
  corner: {
    position: "absolute",
    width: spacing.lg,
    height: spacing.lg,
    borderColor: colors.surface,
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
    fontWeight: typography.bodyStrong.fontWeight,
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
    fontWeight: typography.title.fontWeight,
    color: colors.text,
  },
  instructionDescription: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
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
    fontWeight: typography.bodyStrong.fontWeight,
    color: colors.danger,
  },
  centerCard: {
    alignSelf: "center",
    width: "100%",
    borderRadius: radius.xxl,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
    alignItems: "center",
    marginTop: "40%",
  },
  centerTitle: {
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
    fontWeight: typography.heading.fontWeight,
    color: colors.text,
    textAlign: "center",
  },
  centerDescription: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
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
    fontWeight: typography.label.fontWeight,
    color: colors.primary,
  },
  productName: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontWeight: typography.title.fontWeight,
    color: colors.text,
  },
  productBarcode: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
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
    fontWeight: typography.title.fontWeight,
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
    fontWeight: typography.bodyStrong.fontWeight,
  },
  manualNameHint: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
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
    fontWeight: typography.label.fontWeight,
    color: colors.subtext,
  },
  expiryValue: {
    fontSize: typography.title.fontSize,
    lineHeight: typography.title.lineHeight,
    fontWeight: typography.title.fontWeight,
    color: colors.text,
  },
  sheetFootnote: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    color: colors.subtext,
  },
});
