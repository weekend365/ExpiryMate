import {
  addDays,
  DEFAULT_INVENTORY_FORM,
  ExpirySource,
  type InventoryItem,
  ProductCategory,
  toIsoDate,
} from "@expirymate/shared";
import { CameraView } from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";
import {
  Barcode,
  CalendarDays,
  Flashlight,
  PenLine,
} from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText } from "../../components/AppText";
import { type MascotMood } from "../../components/Mascot";
import { MascotSpeechBubble } from "../../components/MascotSpeechBubble";
import { useMonetization } from "../monetization/monetization-provider";
import { useSaveInventoryItem } from "../registration/use-save-inventory-item";
import { useStorageLocations } from "../settings/use-storage-locations";
import { useActiveSpace } from "../spaces/space-provider";
import { contributeBarcodeProduct } from "../../services/api";
import { colors, spacing } from "../../shared/theme";
import {
  draftForSpace,
  lastStorageLocationForSpace,
  useRegistrationStore,
} from "../../store/registration-store";
import {
  buildScannerQuickAddPayload,
  canQuickAddScannedProduct,
  resolveScannerQuickStorageLocation,
} from "./scanner-quick-add";
import {
  getBarcodeContributionModerationMessage,
  getProhibitedBarcodeContributionFields,
  type BarcodeContributionField,
} from "./barcodeContributionModeration";
import { CloseButton, InlineError, ScannerGuide } from "./scanner-chrome";
import { ScannerConfirmSheet } from "./scanner-confirm-sheet";
import {
  getScannerProductSourceLabel,
  shouldContributeScannedBarcode,
} from "./scanner-confirm-copy";
import { scannerScreenStyles as styles } from "./scanner-screen-styles";
import { useProductScanner } from "./useProductScanner";
import { useResponsiveLayout } from "../../shared/responsive-layout";
import {
  parseRegistrationReturnTo,
  registerRoute,
  registrationReturnHref,
} from "../registration/registration-return";

export function ScannerCameraExperience() {
  const { shouldStack, isPhoneLandscape } = useResponsiveLayout();
  const shouldStackTopBar = shouldStack && !isPhoneLandscape;
  const shouldStackCameraActions = shouldStack && !isPhoneLandscape;
  const params = useLocalSearchParams<{ from?: string | string[] }>();
  const returnTo = parseRegistrationReturnTo(params.from);
  const { activeSpaceId } = useActiveSpace();
  const scanner = useProductScanner();
  const setPrefill = useRegistrationStore((state) => state.setPrefill);
  const setDraft = useRegistrationStore((state) => state.setDraft);
  const clearPrefill = useRegistrationStore((state) => state.clearPrefill);
  const clearDraft = useRegistrationStore((state) => state.clearDraft);
  const setLastStorageLocation = useRegistrationStore(
    (state) => state.setLastStorageLocation,
  );
  const setRewardNotice = useRegistrationStore((state) => state.setRewardNotice);
  const saveInventoryItem = useSaveInventoryItem();
  const { selectableOptions, resolveLabel: resolveStorageLocationLabel } =
    useStorageLocations();
  const monetization = useMonetization();
  const [manualName, setManualName] = useState("");
  const [manualBrand, setManualBrand] = useState("");
  const [manualCategory, setManualCategory] = useState<ProductCategory | null>(
    null,
  );
  const [manualExpiryDate, setManualExpiryDate] = useState("");
  const [manualExpirySource, setManualExpirySource] = useState<ExpirySource>(
    ExpirySource.MANUAL,
  );
  const [isContributing, setIsContributing] = useState(false);
  const [contributeError, setContributeError] = useState<string | null>(null);
  const [prohibitedContribution, setProhibitedContribution] = useState<{
    fields: BarcodeContributionField[];
    message: string;
  } | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [showBarcodeSuccess, setShowBarcodeSuccess] = useState(false);
  const [catalogNameAccepted, setCatalogNameAccepted] = useState(true);
  const [quickQuantity, setQuickQuantity] = useState(
    DEFAULT_INVENTORY_FORM.quantity,
  );
  const [quickStorageLocation, setQuickStorageLocation] = useState<string>(
    DEFAULT_INVENTORY_FORM.storageLocation,
  );
  const [quickSaveError, setQuickSaveError] = useState<string | null>(null);
  const [quickSavedItem, setQuickSavedItem] = useState<InventoryItem | null>(
    null,
  );
  const previousModeRef = useRef(scanner.mode);

  const needsManualName =
    scanner.productLookupStatus === "not-found" ||
    scanner.productLookupStatus === "error" ||
    (scanner.productLookupStatus === "success" && !scanner.product?.name);
  const needsNameConfirmation =
    !needsManualName && (scanner.product?.needsNameConfirmation ?? true);

  const needsManualExpiry = scanner.confirmation?.expirationDate == null;
  const resolvedExpiryDate: string | null = needsManualExpiry
    ? manualExpirySource === ExpirySource.UNKNOWN
      ? null
      : manualExpiryDate
    : (scanner.confirmation?.expirationDate ?? "");
  const resolvedExpirySource = needsManualExpiry
    ? manualExpirySource
    : ExpirySource.OCR_DETECTED;

  const resolvedProductName = needsManualName
    ? manualName.trim()
    : catalogNameAccepted
      ? scanner.product?.name?.trim() ?? ""
      : manualName.trim();
  const resolvedBrand = needsManualName
    ? manualBrand.trim() || undefined
    : catalogNameAccepted
      ? scanner.product?.brand?.trim() || undefined
      : manualBrand.trim() || scanner.product?.brand?.trim() || undefined;
  const resolvedCategory = needsManualName
    ? manualCategory ?? undefined
    : undefined;
  const canQuickSave = canQuickAddScannedProduct({
    productLookupStatus: scanner.productLookupStatus,
    productName: scanner.product?.name,
    needsNameConfirmation,
    expirationDate: scanner.confirmation?.expirationDate,
  });
  const contributionRewards = monetization.access?.contributionRewards;
  const canPromiseBarcodeReward = Boolean(
    contributionRewards?.enabled &&
      scanner.product?.contributionToken &&
      contributionRewards.canEarn,
  );
  const showScanRewardHint =
    scanner.mode === "ocr" && canPromiseBarcodeReward;
  const manualNameHint = scanner.productLookupStatus === "error"
    ? null
    : canPromiseBarcodeReward
    ? resolvedBrand || resolvedCategory
      ? null
      : "브랜드나 카테고리를 함께 알려주세요."
    : "알려주시면 다음에도 바로 불러올 수 있어요.";

  const resultMood: MascotMood =
    needsManualName || needsManualExpiry ? "worry" : "happy";

  const productSourceLabel = getScannerProductSourceLabel({
    productLookupStatus: scanner.productLookupStatus,
    needsManualName,
    productSource: scanner.product?.source,
  });

  const guideMood: Extract<MascotMood, "speak" | "think"> =
    showScanRewardHint || showBarcodeSuccess
      ? "speak"
      : scanner.mode === "ocr" && scanner.isOcrProcessing
        ? "think"
        : "speak";

  const guideMessage = showBarcodeSuccess
    ? "바코드를 읽었어요. 이제 유통기한을 같은 곳에 비춰 주세요."
    : scanner.mode === "barcode"
      ? "바코드를 가운데에 맞춰 주세요. 인식되면 유통기한도 이어서 볼게요."
      : showScanRewardHint
        ? "아직 없는 상품이에요. 정보를 알려주시면 추천권 1회를 드려요. 유통기한은 같은 곳에 이어서 비춰 주세요."
        : scanner.isOcrProcessing
          ? "날짜를 읽고 있어요. 조금만 기다려 주세요."
          : "유통기한이 잘 보이게 비춰 주세요. 또렷하면 장고가 읽어볼게요.";
  const compactGuideMessage = showBarcodeSuccess
    ? "바코드를 읽었어요. 이제 유통기한을 비춰 주세요."
    : scanner.mode === "barcode"
      ? "바코드를 가운데에 맞춰 주세요."
      : scanner.isOcrProcessing
        ? "유통기한을 읽고 있어요."
        : "유통기한이 잘 보이게 비춰 주세요.";

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
      setCatalogNameAccepted(true);
      return;
    }

    setCatalogNameAccepted(true);
    if (scanner.product?.name) {
      setManualName(scanner.product.name);
      setManualBrand(scanner.product.brand ?? "");
    }
  }, [scanner.confirmation, scanner.product?.brand, scanner.product?.name]);

  const confirmationBarcode = scanner.confirmation?.barcode ?? null;

  useEffect(() => {
    if (!confirmationBarcode) {
      setQuickSaveError(null);
      return;
    }

    const storeState = useRegistrationStore.getState();
    setQuickQuantity(DEFAULT_INVENTORY_FORM.quantity);
    setQuickStorageLocation(
      resolveScannerQuickStorageLocation({
        draftStorageLocation: draftForSpace(storeState, activeSpaceId)
          ?.storageLocation,
        lastStorageLocation: lastStorageLocationForSpace(
          storeState,
          activeSpaceId,
        ),
      }),
    );
    setQuickSaveError(null);
    setQuickSavedItem(null);
  }, [activeSpaceId, confirmationBarcode]);

  useEffect(() => {
    const availableLocationKeys = selectableOptions.map(
      (option) => option.key,
    );

    if (!confirmationBarcode || availableLocationKeys.length === 0) {
      return;
    }

    setQuickStorageLocation((current) =>
      availableLocationKeys.includes(current)
        ? current
        : resolveScannerQuickStorageLocation({ availableLocationKeys }),
    );
  }, [confirmationBarcode, selectableOptions]);

  const completeRegistration = (productMasterId?: string | null) => {
    if (!activeSpaceId) {
      return;
    }

    setPrefill(activeSpaceId, {
      productMasterId: productMasterId ?? undefined,
      catalogName: scanner.product?.name?.trim() || undefined,
      catalogBrand: scanner.product?.brand?.trim() || undefined,
      displayName: resolvedProductName,
      brand: resolvedBrand,
      category: resolvedCategory,
    });
    setDraft(activeSpaceId, {
      productMasterId: productMasterId ?? undefined,
      catalogName: scanner.product?.name?.trim() || undefined,
      catalogBrand: scanner.product?.brand?.trim() || undefined,
      displayName: resolvedProductName,
      brand: resolvedBrand,
      category: resolvedCategory,
      quantity: quickQuantity,
      unit: DEFAULT_INVENTORY_FORM.unit,
      expiryDate: resolvedExpiryDate,
      expirySource: resolvedExpirySource,
      storageLocation: quickStorageLocation,
    });
    // Clear confirmation so the Modal sheet dismisses; replace so scanner
    // unmounts and cannot keep overlaying /register.
    scanner.resetScanner();
    router.replace(registerRoute(returnTo));
  };

  const handleUseScanResult = async () => {
    if (
      !scanner.confirmation ||
      !resolvedProductName ||
      (!resolvedExpiryDate && resolvedExpirySource !== ExpirySource.UNKNOWN)
    ) {
      return;
    }

    setContributeError(null);
    setProhibitedContribution(null);
    setRewardNotice(null);

    let productMasterId = scanner.product?.productMasterId ?? null;

    if (
      needsManualName &&
      scanner.confirmation.barcode &&
      shouldContributeScannedBarcode(scanner.productLookupStatus)
    ) {
      setIsContributing(true);

      try {
        const contribution = await contributeBarcodeProduct({
          barcode: scanner.confirmation.barcode,
          name: resolvedProductName,
          brand: resolvedBrand,
          category: resolvedCategory,
          contributionToken: scanner.product?.contributionToken,
        });
        productMasterId = contribution.product.id;
        if (contribution.reward.reason !== "rewards_disabled") {
          setRewardNotice({
            granted: contribution.reward.granted,
            reason: contribution.reward.reason,
            creditsGranted: contribution.reward.creditsGranted,
            balance: contribution.reward.balance,
            balanceLimit: contribution.reward.balanceLimit,
          });
        }
        if (contribution.reward.granted) {
          await monetization.refresh().catch(() => undefined);
        }
      } catch (error) {
        const prohibitedFields = getProhibitedBarcodeContributionFields(error);
        if (prohibitedFields) {
          setProhibitedContribution({
            fields: prohibitedFields,
            message: getBarcodeContributionModerationMessage(prohibitedFields),
          });
          return;
        }
        setContributeError(
          error instanceof Error
            ? error.message
            : "이름은 기억해 뒀지만, 공유 목록에는 아직 못 넣었어요.",
        );
      } finally {
        setIsContributing(false);
      }
    }

    completeRegistration(productMasterId);
  };

  const handleContinueWithoutContribution = () => {
    setRewardNotice(null);
    completeRegistration(scanner.product?.productMasterId ?? null);
  };

  const handleQuickSave = async () => {
    if (
      !canQuickSave ||
      !scanner.product?.name ||
      !scanner.confirmation?.expirationDate
    ) {
      return;
    }

    setQuickSaveError(null);
    setRewardNotice(null);

    try {
      const created = await saveInventoryItem.mutateAsync(
        buildScannerQuickAddPayload({
          productMasterId: scanner.product.productMasterId,
          displayName: scanner.product.name,
          brand: scanner.product.brand,
          quantity: quickQuantity,
          storageLocation: quickStorageLocation,
          expiryDate: scanner.confirmation.expirationDate,
        }),
      );

      if (activeSpaceId) {
        clearPrefill(activeSpaceId);
        clearDraft(activeSpaceId);
        setLastStorageLocation(activeSpaceId, quickStorageLocation);
      }
      setQuickSavedItem(created);
    } catch (error) {
      setQuickSaveError(
        error instanceof Error
          ? error.message
          : "냉장고에 넣지 못했어요. 다시 해볼까요?",
      );
    }
  };

  const handleRescan = () => {
    setManualName("");
    setManualBrand("");
    setManualCategory(null);
    setManualExpiryDate("");
    setManualExpirySource(ExpirySource.MANUAL);
    setContributeError(null);
    setProhibitedContribution(null);
    setShowBarcodeSuccess(false);
    setCatalogNameAccepted(true);
    setQuickQuantity(DEFAULT_INVENTORY_FORM.quantity);
    setQuickSaveError(null);
    setQuickSavedItem(null);
    saveInventoryItem.reset();
    scanner.resetScanner();
  };

  const handleFinishQuickAdd = () => {
    setQuickSavedItem(null);
    scanner.resetScanner();
    router.replace(registrationReturnHref(returnTo));
  };

  const handleEditQuickSavedItem = () => {
    const savedItemId = quickSavedItem?.id;

    if (!savedItemId) {
      return;
    }

    setQuickSavedItem(null);
    scanner.resetScanner();
    router.replace({
      pathname: "/inventory/[id]",
      params: { id: savedItemId },
    });
  };

  const handleManualRegistration = () => {
    if (activeSpaceId) {
      setPrefill(activeSpaceId, null);
      setDraft(activeSpaceId, null);
    }
    scanner.resetScanner();
    router.replace(registerRoute(returnTo));
  };

  const handlePresetExpiry = (days: number) => {
    setManualExpiryDate(toIsoDate(addDays(new Date(), days)));
    setManualExpirySource(ExpirySource.PRESET);
  };

  const handleManualExpiryChange = (nextDate: string) => {
    setManualExpiryDate(nextDate);
    setManualExpirySource(ExpirySource.MANUAL);
  };

  const handleUnknownExpiry = () => {
    setManualExpiryDate("");
    setManualExpirySource(ExpirySource.UNKNOWN);
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

      <SafeAreaView
        style={styles.overlay}
        pointerEvents="box-none"
        collapsable={false}
      >
        <View style={[styles.topBar, shouldStackTopBar && styles.topBarStacked]}>
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
            <AppText
              variant="bodySmall"
              scaleRole="chrome"
              densityAware={false}
              style={styles.stepPillText}
            >
              {scanner.mode === "barcode" ? "1/2 바코드" : "2/2 유통기한"}
            </AppText>
          </View>
        </View>

        {!scanner.isCameraReady ? (
          <View style={styles.centerStage}>
            <View style={styles.centerCard}>
              <AppText variant="heading" style={styles.centerTitle}>
                카메라를 준비하고 있어요
              </AppText>
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
              guideMessage={
                hasInlineScanError
                  ? null
                  : isPhoneLandscape
                    ? compactGuideMessage
                    : guideMessage
              }
              guideMood={guideMood}
              compactHeight={isPhoneLandscape}
              onGuideFrameChange={scanner.setGuideFrame}
            />

            <View style={styles.bottomStack}>
              {scanner.productLookupStatus === "loading" ? (
                <View style={styles.loadingStrip}>
                  <ActivityIndicator color={colors.primary} />
                  <AppText variant="bodySmall" tone="subtext">
                    상품을 찾아보고 있어요
                  </AppText>
                </View>
              ) : null}

              {scanner.cameraErrorMessage ? (
                <InlineError message={scanner.cameraErrorMessage} />
              ) : null}

              {scanner.mode === "ocr" && scanner.ocrErrorMessage ? (
                <InlineError message={scanner.ocrErrorMessage} />
              ) : null}

              <View
                style={[
                  styles.cameraActions,
                  shouldStackCameraActions && styles.cameraActionsStacked,
                ]}
              >
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
                    accessibilityLabel="유통기한 직접 선택"
                  style={({ pressed }) => [
                    styles.manualAction,
                    shouldStackCameraActions && styles.manualActionStacked,
                    pressed && styles.manualActionPressed,
                  ]}
                  >
                    <CalendarDays
                      color={colors.surface}
                      size={spacing.sm + spacing.xxs}
                      strokeWidth={2.4}
                    />
                    <AppText style={styles.manualActionLabel}>
                      유통기한이 안 보여요
                    </AppText>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={handleManualRegistration}
                    accessibilityRole="button"
                    accessibilityLabel="바코드 없이 직접 입력"
                  style={({ pressed }) => [
                    styles.manualAction,
                    shouldStackCameraActions && styles.manualActionStacked,
                    pressed && styles.manualActionPressed,
                  ]}
                  >
                    <PenLine
                      color={colors.surface}
                      size={spacing.sm + spacing.xxs}
                      strokeWidth={2.4}
                    />
                    <AppText style={styles.manualActionLabel}>직접 입력</AppText>
                  </Pressable>
                )}
              </View>
            </View>
          </>
        )}
      </SafeAreaView>

      <ScannerConfirmSheet
        confirmation={scanner.confirmation}
        product={scanner.product}
        productLookupStatus={scanner.productLookupStatus}
        productErrorMessage={scanner.productErrorMessage}
        productSourceLabel={productSourceLabel}
        resultMood={resultMood}
        needsManualName={needsManualName}
        needsNameConfirmation={needsNameConfirmation}
        needsManualExpiry={needsManualExpiry}
        catalogNameAccepted={catalogNameAccepted}
        manualName={manualName}
        manualBrand={manualBrand}
        manualCategory={manualCategory}
        manualExpiryDate={manualExpiryDate}
        manualExpirySource={manualExpirySource}
        manualNameHint={manualNameHint}
        resolvedProductName={resolvedProductName}
        resolvedExpiryDate={resolvedExpiryDate}
        canQuickSave={canQuickSave}
        quickQuantity={quickQuantity}
        quickStorageLocation={quickStorageLocation}
        quickStorageLocationLabel={resolveStorageLocationLabel(
          quickStorageLocation,
        )}
        quickStorageLocationOptions={selectableOptions}
        quickSavedItem={quickSavedItem}
        isQuickSaving={saveInventoryItem.isPending}
        quickSaveError={quickSaveError}
        isContributing={isContributing}
        contributeError={contributeError}
        prohibitedContribution={prohibitedContribution}
        onClose={handleRescan}
        onRescan={handleRescan}
        onUseScanResult={() => {
          void handleUseScanResult();
        }}
        onQuickSave={() => {
          void handleQuickSave();
        }}
        onQuickQuantityChange={(quantity) => {
          setQuickQuantity(quantity);
          setQuickSaveError(null);
        }}
        onQuickStorageLocationChange={(location) => {
          setQuickStorageLocation(location);
          setQuickSaveError(null);
        }}
        onScanNext={handleRescan}
        onFinishQuickAdd={handleFinishQuickAdd}
        onEditQuickSavedItem={handleEditQuickSavedItem}
        onContinueWithoutContribution={handleContinueWithoutContribution}
        onCatalogNameAccepted={setCatalogNameAccepted}
        onManualNameChange={setManualName}
        onManualBrandChange={setManualBrand}
        onManualCategoryChange={setManualCategory}
        onPresetExpiry={handlePresetExpiry}
        onManualExpiryChange={handleManualExpiryChange}
        onUnknownExpiry={handleUnknownExpiry}
      />
    </>
  );
}
