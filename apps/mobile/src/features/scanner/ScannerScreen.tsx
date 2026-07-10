import { BarcodeLookupSource, ExpirySource } from "@expirymate/shared";
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
import { CameraView, useCameraPermissions } from "expo-camera";
import { Button } from "../../components/Button";
import { contributeBarcodeProduct } from "../../services/api";
import { colors, radius, spacing } from "../../shared/theme";
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="스캐너 닫기"
              onPress={() => router.back()}
              style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
            >
              <X color={colors.surface} size={22} strokeWidth={2.6} />
            </Pressable>
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

  const instruction =
    scanner.mode === "barcode"
      ? "상품 뒷면의 바코드를 스캔해 주세요."
      : "유통기한 날짜가 잘 보이게 비춰주세요";
  const stepLabel =
    scanner.mode === "barcode"
      ? "1/2 바코드 스캔"
      : scanner.mode === "ocr"
        ? "2/2 유통기한 인식"
        : "등록 정보 확인";

  const needsManualName =
    scanner.productLookupStatus === "not-found" ||
    scanner.productLookupStatus === "error" ||
    (scanner.productLookupStatus === "success" && !scanner.product?.name);

  const resolvedProductName = needsManualName
    ? manualName.trim()
    : scanner.product?.name?.trim() ?? "";

  const productSourceLabel =
    scanner.productLookupStatus === "loading"
      ? "상품 정보를 찾고 있어요"
      : scanner.product?.source === BarcodeLookupSource.PRODUCT_MASTER
        ? "우리 냉장고 목록에서 찾았어요"
        : scanner.product?.source === BarcodeLookupSource.OPEN_FOOD_FACTS
          ? "Open Food Facts에서 찾았어요"
          : needsManualName
            ? "이름을 직접 알려주세요"
            : "상품 정보";

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
            : "재료 이름은 저장했지만, 공유 목록에는 아직 못 넣었어요.",
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

      <SafeAreaView style={styles.overlay}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="스캐너 닫기"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
          >
            <X color={colors.surface} size={22} strokeWidth={2.6} />
          </Pressable>
          <View style={styles.stepPill}>
            {scanner.mode === "barcode" ? (
              <Barcode color={colors.surface} size={17} strokeWidth={2.6} />
            ) : (
              <CalendarDays color={colors.surface} size={17} strokeWidth={2.6} />
            )}
            <Text style={styles.stepPillText}>{stepLabel}</Text>
          </View>
        </View>

        {!scanner.isCameraReady ? (
          <StatusCard
            title="카메라를 준비하고 있어요"
            description="잠시만 기다려 주세요."
          />
        ) : (
          <>
            <View style={styles.guideArea}>
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
                  <Text style={styles.loadingText}>상품 정보를 조회 중입니다...</Text>
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
                    <Barcode color={colors.primary} size={22} strokeWidth={2.6} />
                  ) : (
                    <CalendarDays color={colors.primary} size={22} strokeWidth={2.6} />
                  )}
                </View>
                <View style={styles.instructionCopy}>
                  <Text style={styles.instructionTitle}>{instruction}</Text>
                  <Text style={styles.instructionDescription}>
                    {scanner.mode === "barcode"
                      ? "인식되면 같은 화면에서 바로 유통기한 스캔으로 이어집니다."
                      : scanner.isOcrProcessing
                        ? "날짜 후보를 확인하고 있어요."
                        : "YYYY.MM.DD, YY.MM.DD, YYYY년 MM월 DD일 형태를 찾고 있어요."}
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}
      </SafeAreaView>

      {scanner.confirmation ? (
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={styles.sheetIcon}>
                <CheckCircle2 color={colors.success} size={24} strokeWidth={2.6} />
              </View>
              <View style={styles.sheetHeaderCopy}>
                <Text style={styles.sheetTitle}>스캔 결과를 확인해 주세요</Text>
                <Text style={styles.sheetDescription}>
                  상품명과 유통기한을 등록 화면에 자동으로 채워드릴게요.
                </Text>
              </View>
            </View>

            <View style={styles.productRow}>
              {scanner.product?.imageUrl ? (
                <Image source={{ uri: scanner.product.imageUrl }} style={styles.productImage} />
              ) : (
                <View style={styles.productImageFallback}>
                  <Package color={colors.primary} size={24} strokeWidth={2.6} />
                </View>
              )}
              <View style={styles.productCopy}>
                <Text style={styles.productEyebrow}>{productSourceLabel}</Text>
                {needsManualName ? (
                  <Text style={styles.productName}>아직 이름이 없어요</Text>
                ) : (
                  <Text style={styles.productName}>
                    {scanner.product?.name ?? "상품명 확인 중"}
                  </Text>
                )}
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
              <Text style={styles.expiryLabel}>인식한 유통기한</Text>
              <Text style={styles.expiryValue}>{scanner.confirmation.expirationDate}</Text>
            </View>

            {scanner.productErrorMessage ? (
              <Text style={styles.sheetFootnote}>
                상품 조회는 잠시 막혔지만, 이름을 직접 적으면 등록할 수 있어요.
              </Text>
            ) : null}

            {contributeError ? (
              <Text style={styles.sheetFootnote}>{contributeError}</Text>
            ) : null}

            <View style={styles.sheetActions}>
              <Button
                variant="secondary"
                icon={RotateCcw}
                onPress={() => {
                  setManualName("");
                  setContributeError(null);
                  scanner.resetScanner();
                }}
                style={styles.sheetButton}
                disabled={isContributing}
              >
                다시 스캔
              </Button>
              <Button
                icon={CheckCircle2}
                iconPosition="right"
                onPress={() => {
                  void handleUseScanResult();
                }}
                style={styles.sheetButton}
                disabled={
                  !resolvedProductName ||
                  isContributing ||
                  scanner.productLookupStatus === "loading"
                }
                loading={isContributing || scanner.productLookupStatus === "loading"}
              >
                등록하기
              </Button>
            </View>
          </View>
        </View>
      ) : null}
    </>
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
      <Text style={styles.centerTitle}>카메라 권한이 필요해요</Text>
      <Text style={styles.centerDescription}>
        바코드와 유통기한을 스캔하려면 카메라 접근을 허용해 주세요.
      </Text>
      <Button
        onPress={onRequestPermission}
        disabled={!canRequestPermission && !isRequesting}
        fullWidth
      >
        권한 허용
      </Button>
    </View>
  );
}

function StatusCard({ title, description }: { title: string; description: string }) {
  return (
    <View style={styles.centerCard}>
      <Text style={styles.centerTitle}>{title}</Text>
      <Text style={styles.centerDescription}>{description}</Text>
    </View>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <View style={styles.errorStrip}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#05070A",
  },
  emptyCamera: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#05070A",
  },
  overlay: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing.sm,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  iconButtonPressed: {
    backgroundColor: "rgba(0,0,0,0.62)",
  },
  stepPill: {
    minHeight: 40,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  stepPillText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    color: colors.surface,
  },
  guideArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  roiBox: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.78)",
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  barcodeRoiBox: {
    width: "86%",
    height: 180,
    borderRadius: 22,
  },
  ocrRoiBox: {
    width: "88%",
    height: 104,
    borderRadius: 16,
  },
  corner: {
    position: "absolute",
    width: 34,
    height: 34,
    borderColor: colors.surface,
  },
  cornerTopLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 18,
  },
  cornerTopRight: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 18,
  },
  cornerBottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 18,
  },
  cornerBottomRight: {
    right: -2,
    bottom: -2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderBottomRightRadius: 18,
  },
  bottomStack: {
    gap: spacing.sm,
  },
  loadingStrip: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: colors.text,
  },
  instructionCard: {
    borderRadius: 20,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  instructionIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  instructionCopy: {
    flex: 1,
    gap: 5,
  },
  instructionTitle: {
    fontSize: 18,
    lineHeight: 25,
    fontWeight: "800",
    color: colors.text,
  },
  instructionDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.subtext,
  },
  errorStrip: {
    borderRadius: 14,
    backgroundColor: colors.dangerSoft,
    padding: spacing.md,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: colors.danger,
  },
  centerCard: {
    alignSelf: "center",
    width: "100%",
    borderRadius: 20,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
    marginTop: "45%",
  },
  centerTitle: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "800",
    color: colors.text,
  },
  centerDescription: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.subtext,
  },
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.34)",
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  sheetIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.successSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetHeaderCopy: {
    flex: 1,
    gap: 5,
  },
  sheetTitle: {
    fontSize: 21,
    lineHeight: 29,
    fontWeight: "800",
    color: colors.text,
  },
  sheetDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.subtext,
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: 16,
    backgroundColor: colors.mutedSurface,
    padding: spacing.md,
  },
  productImage: {
    width: 66,
    height: 66,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  productImageFallback: {
    width: 66,
    height: 66,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  productCopy: {
    flex: 1,
    gap: 4,
  },
  productEyebrow: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
    color: colors.primary,
  },
  productName: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "800",
    color: colors.text,
  },
  productBarcode: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.subtext,
  },
  manualNameCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.mutedSurface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  manualNameLabel: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "800",
    color: colors.text,
  },
  manualNameInput: {
    minHeight: 52,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  manualNameHint: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.subtext,
  },
  expiryCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
  },
  expiryLabel: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    color: colors.subtext,
  },
  expiryValue: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "800",
    color: colors.text,
  },
  sheetFootnote: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.subtext,
  },
  sheetActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  sheetButton: {
    flex: 1,
  },
});
