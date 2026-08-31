import {
  ExpirySource,
  formatDateKorean,
  formatInventoryQuantity,
  type InventoryItem,
  ProductCategory,
  productCategoryLabels,
  productCategoryOptions,
} from "@expirymate/shared";
import {
  Barcode,
  CheckCircle2,
  Package,
  PenLine,
  RotateCcw,
} from "lucide-react-native";
import { Image, View } from "react-native";
import { BottomSheet } from "../../components/BottomSheet";
import { Button } from "../../components/Button";
import { AppText } from "../../components/AppText";
import { AppTextInput } from "../../components/AppTextInput";
import { type MascotMood } from "../../components/Mascot";
import { Pill } from "../../components/Pill";
import { QuantityStepper } from "../../components/QuantityStepper";
import { colors, spacing } from "../../shared/theme";
import type { BarcodeContributionField } from "./barcodeContributionModeration";
import { getScannerConfirmDescription } from "./scanner-confirm-copy";
import { ManualExpirySection } from "./scanner-manual-expiry";
import { scannerScreenStyles as styles } from "./scanner-screen-styles";
import type { ProductInfo, ScannerConfirmation } from "./useProductScanner";

export function ScannerConfirmSheet({
  confirmation,
  product,
  productLookupStatus,
  productErrorMessage,
  productSourceLabel,
  resultMood,
  needsManualName,
  needsNameConfirmation,
  needsManualExpiry,
  catalogNameAccepted,
  manualName,
  manualBrand,
  manualCategory,
  manualExpiryDate,
  manualExpirySource,
  manualNameHint,
  resolvedProductName,
  resolvedExpiryDate,
  canQuickSave,
  quickQuantity,
  quickStorageLocation,
  quickStorageLocationLabel,
  quickStorageLocationOptions,
  quickSavedItem,
  isQuickSaving,
  quickSaveError,
  isContributing,
  contributeError,
  prohibitedContribution,
  onClose,
  onRescan,
  onUseScanResult,
  onQuickSave,
  onQuickQuantityChange,
  onQuickStorageLocationChange,
  onScanNext,
  onFinishQuickAdd,
  onEditQuickSavedItem,
  onContinueWithoutContribution,
  onCatalogNameAccepted,
  onManualNameChange,
  onManualBrandChange,
  onManualCategoryChange,
  onPresetExpiry,
  onManualExpiryChange,
  onUnknownExpiry,
}: {
  confirmation: ScannerConfirmation | null;
  product: ProductInfo | null;
  productLookupStatus: "idle" | "loading" | "success" | "not-found" | "error";
  productErrorMessage: string | null;
  productSourceLabel: string;
  resultMood: MascotMood;
  needsManualName: boolean;
  needsNameConfirmation: boolean;
  needsManualExpiry: boolean;
  catalogNameAccepted: boolean;
  manualName: string;
  manualBrand: string;
  manualCategory: ProductCategory | null;
  manualExpiryDate: string;
  manualExpirySource: ExpirySource;
  manualNameHint: string | null;
  resolvedProductName: string;
  resolvedExpiryDate: string | null;
  canQuickSave: boolean;
  quickQuantity: number;
  quickStorageLocation: string;
  quickStorageLocationLabel: string;
  quickStorageLocationOptions: Array<{ key: string; label: string }>;
  quickSavedItem: InventoryItem | null;
  isQuickSaving: boolean;
  quickSaveError: string | null;
  isContributing: boolean;
  contributeError: string | null;
  prohibitedContribution: {
    fields: BarcodeContributionField[];
    message: string;
  } | null;
  onClose: () => void;
  onRescan: () => void;
  onUseScanResult: () => void;
  onQuickSave: () => void;
  onQuickQuantityChange: (quantity: number) => void;
  onQuickStorageLocationChange: (location: string) => void;
  onScanNext: () => void;
  onFinishQuickAdd: () => void;
  onEditQuickSavedItem: () => void;
  onContinueWithoutContribution: () => void;
  onCatalogNameAccepted: (accepted: boolean) => void;
  onManualNameChange: (value: string) => void;
  onManualBrandChange: (value: string) => void;
  onManualCategoryChange: (value: ProductCategory) => void;
  onPresetExpiry: (days: number) => void;
  onManualExpiryChange: (value: string) => void;
  onUnknownExpiry: () => void;
}) {
  const isBusy = isContributing || isQuickSaving;
  const quickLocationOptions = quickStorageLocationOptions.some(
    (option) => option.key === quickStorageLocation,
  )
    ? quickStorageLocationOptions
    : [
        {
          key: quickStorageLocation,
          label: quickStorageLocationLabel,
        },
        ...quickStorageLocationOptions,
      ];
  const sheetDescription = quickSavedItem
    ? "수량과 보관 위치까지 바로 반영했어요."
    : canQuickSave
      ? "넣을 내용을 확인하고 바로 냉장고에 반영할 수 있어요."
      : getScannerConfirmDescription({
          needsManualName,
          needsManualExpiry,
          catalogNameAccepted,
          needsNameConfirmation,
          productLookupStatus,
        });
  const sheetTitle = quickSavedItem
    ? "냉장고에 넣어 뒀어요"
    : needsManualName
      ? "이 재료 이름을 알려줄래요?"
      : !catalogNameAccepted
        ? "우리 집에서는 뭐라고 부를까요?"
        : needsManualExpiry
          ? "유통기한은 언제까지인가요?"
          : needsNameConfirmation
            ? "한 번만 확인해 주세요"
            : "이걸로 넣을까요?";

  return (
    <BottomSheet
      visible={Boolean(confirmation || quickSavedItem)}
      onClose={onClose}
      dismissible={false}
      mascotMood={quickSavedItem ? "happy" : resultMood}
      title={sheetTitle}
      description={sheetDescription}
      footer={
        <View style={styles.sheetFooter}>
          {quickSavedItem ? (
            <>
              <Button
                icon={Barcode}
                onPress={onScanNext}
                fullWidth
                testID="scanner-scan-next-button"
              >
                다음 재료 스캔
              </Button>
              <Button
                icon={PenLine}
                variant="secondary"
                onPress={onEditQuickSavedItem}
                fullWidth
                testID="scanner-edit-saved-button"
              >
                방금 추가한 재료 수정
              </Button>
              <Button
                variant="surface"
                onPress={onFinishQuickAdd}
                fullWidth
                testID="scanner-finish-button"
              >
                추가 완료
              </Button>
            </>
          ) : null}
          {!quickSavedItem &&
          needsManualExpiry &&
          !resolvedExpiryDate &&
          manualExpirySource !== ExpirySource.UNKNOWN ? (
            <AppText style={styles.ctaHint} accessibilityLiveRegion="polite">
              날짜만 골라 주시면 넣을게요
            </AppText>
          ) : null}
          {!quickSavedItem ? (
            <Button
              variant="secondary"
              icon={RotateCcw}
              onPress={onRescan}
              disabled={isBusy}
              fullWidth
            >
              다시 스캔
            </Button>
          ) : null}
          {!quickSavedItem && canQuickSave ? (
            <Button
              variant="surface"
              onPress={onUseScanResult}
              disabled={isBusy}
              fullWidth
              testID="scanner-detailed-edit-button"
            >
              상세 정보 수정
            </Button>
          ) : null}
          {!quickSavedItem && prohibitedContribution ? (
            <Button
              variant="secondary"
              onPress={onContinueWithoutContribution}
              disabled={isBusy}
              fullWidth
            >
              기여 없이 계속 등록
            </Button>
          ) : null}
          {!quickSavedItem ? (
            <Button
              icon={CheckCircle2}
              iconPosition="right"
              onPress={canQuickSave ? onQuickSave : onUseScanResult}
              disabled={
                !resolvedProductName ||
                (!resolvedExpiryDate &&
                  manualExpirySource !== ExpirySource.UNKNOWN) ||
                isBusy ||
                productLookupStatus === "loading"
              }
              loading={
                isQuickSaving ||
                isContributing ||
                productLookupStatus === "loading"
              }
              fullWidth
              testID="scanner-quick-save-button"
            >
              {canQuickSave
                ? quickSaveError
                  ? "다시 추가"
                  : "재료 추가"
                : prohibitedContribution
                  ? "수정 후 다시 시도"
                  : "수량·위치 입력"}
            </Button>
          ) : null}
        </View>
      }
    >
      {quickSavedItem ? (
        <QuickSavedSummary
          item={quickSavedItem}
          storageLocationLabel={quickStorageLocationLabel}
        />
      ) : confirmation ? (
        <>
          <View style={styles.productRow}>
            {product?.imageUrl ? (
              <Image
                source={{ uri: product.imageUrl }}
                style={styles.productImage}
                accessibilityLabel={`${product?.name ?? "상품"} 이미지`}
              />
            ) : (
              <View style={styles.productImageFallback}>
                <Package color={colors.primaryForeground} size={spacing.md} strokeWidth={2.4} />
              </View>
            )}
            <View style={styles.productCopy}>
              <AppText style={styles.productEyebrow}>{productSourceLabel}</AppText>
              <AppText style={styles.productName}>
                {needsManualName
                  ? "아직 이름이 없어요"
                  : product?.name ?? "상품명을 찾고 있어요"}
              </AppText>
              <AppText style={styles.productBarcode}>
                바코드 {confirmation.barcode}
              </AppText>
              {!needsManualName && !needsNameConfirmation ? (
                <AppText style={styles.manualNameHint}>
                  이름이 다르면 ‘상세 정보 수정’에서 바꿀 수 있어요.
                </AppText>
              ) : null}
            </View>
          </View>

          {!needsManualName && needsNameConfirmation ? (
            <View style={styles.manualNameCard}>
              <AppText style={styles.manualNameLabel}>한 번만 확인해 주세요</AppText>
              <View style={styles.pillRow}>
                <Pill
                  label="맞아요"
                  selected={catalogNameAccepted}
                  onPress={() => onCatalogNameAccepted(true)}
                />
                <Pill
                  label="다른 이름이에요"
                  selected={!catalogNameAccepted}
                  onPress={() => {
                    onCatalogNameAccepted(false);
                    if (!manualName.trim() && product?.name) {
                      onManualNameChange(product.name);
                    }
                    if (!manualBrand.trim() && product?.brand) {
                      onManualBrandChange(product.brand);
                    }
                  }}
                />
              </View>
              {!catalogNameAccepted ? (
                <>
                  <AppText style={styles.manualNameLabel}>냉장고에 넣을 이름</AppText>
                  <AppTextInput
                    value={manualName}
                    onChangeText={onManualNameChange}
                    accessibilityLabel="냉장고에 넣을 이름"
                    placeholder="예: 서울우유 1L"
                    placeholderTextColor={colors.mutedText}
                    style={styles.manualNameInput}
                    autoCorrect={false}
                    returnKeyType="done"
                  />
                  <AppText style={styles.manualNameLabel}>브랜드</AppText>
                  <AppTextInput
                    value={manualBrand}
                    onChangeText={onManualBrandChange}
                    accessibilityLabel="브랜드"
                    placeholder="예: 서울우유"
                    placeholderTextColor={colors.mutedText}
                    style={styles.manualNameInput}
                    autoCorrect={false}
                    returnKeyType="done"
                  />
                  <AppText style={styles.manualNameHint}>
                    목록 이름은 그대로 두고, 냉장고에는 지금 이름으로 넣을게요.
                  </AppText>
                </>
              ) : null}
            </View>
          ) : null}

          {needsManualName ? (
            <View style={styles.manualNameCard}>
              <AppText style={styles.manualNameLabel}>이 재료 이름이 뭐예요?</AppText>
              <AppTextInput
                value={manualName}
                onChangeText={onManualNameChange}
                accessibilityLabel="재료 이름"
                placeholder="예: 서울우유 1L"
                placeholderTextColor={colors.mutedText}
                style={[
                  styles.manualNameInput,
                  prohibitedContribution?.fields.includes("name") &&
                    styles.manualNameInputError,
                ]}
                autoCorrect={false}
                returnKeyType="done"
              />
              <AppText style={styles.manualNameLabel}>브랜드</AppText>
              <AppTextInput
                value={manualBrand}
                onChangeText={onManualBrandChange}
                accessibilityLabel="브랜드"
                placeholder="예: 서울우유"
                placeholderTextColor={colors.mutedText}
                style={[
                  styles.manualNameInput,
                  prohibitedContribution?.fields.includes("brand") &&
                    styles.manualNameInputError,
                ]}
                autoCorrect={false}
                returnKeyType="done"
              />
              <AppText style={styles.manualNameLabel}>카테고리</AppText>
              <View style={styles.pillRow}>
                {productCategoryOptions.map((option) => (
                  <Pill
                    key={option.value}
                    label={option.label}
                    selected={manualCategory === option.value}
                    onPress={() =>
                      onManualCategoryChange(option.value as ProductCategory)
                    }
                  />
                ))}
              </View>
              {manualCategory ? (
                <AppText style={styles.manualNameHint}>
                  선택: {productCategoryLabels[manualCategory]}
                </AppText>
              ) : null}
              {manualNameHint ? (
                <AppText style={styles.manualNameHint}>{manualNameHint}</AppText>
              ) : null}
            </View>
          ) : null}

          {canQuickSave ? (
            <View style={styles.quickAdjustmentCard}>
              <View style={styles.quickAdjustmentHeader}>
                <AppText style={styles.manualNameLabel}>넣을 내용</AppText>
                <AppText style={styles.manualNameHint}>
                  기본값이 다를 때만 바꿔 주세요.
                </AppText>
              </View>
              <QuantityStepper
                label="수량"
                value={quickQuantity}
                unitSuffix="개"
                onChange={onQuickQuantityChange}
              />
              <View style={styles.quickLocationBlock}>
                <AppText style={styles.expiryLabel}>보관 위치</AppText>
                <View style={styles.pillRow}>
                  {quickLocationOptions.map((option) => (
                    <Pill
                      key={option.key}
                      label={option.label}
                      selected={quickStorageLocation === option.key}
                      onPress={() =>
                        onQuickStorageLocationChange(option.key)
                      }
                    />
                  ))}
                </View>
              </View>
            </View>
          ) : null}

          {needsManualExpiry ? (
            <ManualExpirySection
              expiryDate={manualExpiryDate}
              expirySource={manualExpirySource}
              onPreset={onPresetExpiry}
              onManualChange={onManualExpiryChange}
              onUnknown={onUnknownExpiry}
            />
          ) : (
            <View style={styles.expiryCard}>
              <AppText style={styles.expiryLabel}>읽은 유통기한</AppText>
              <AppText style={styles.expiryValue}>
                {confirmation.expirationDate}
              </AppText>
            </View>
          )}

          {quickSaveError ? (
            <View style={styles.moderationErrorCard} accessibilityRole="alert">
              <AppText style={styles.moderationErrorText}>
                {quickSaveError}
              </AppText>
            </View>
          ) : null}

          {productErrorMessage ? (
            <AppText style={styles.sheetFootnote}>
              상품 조회는 잠시 막혔지만, 이름을 직접 적으면 넣을 수 있어요.
            </AppText>
          ) : null}

          {prohibitedContribution ? (
            <View style={styles.moderationErrorCard} accessibilityRole="alert">
              <AppText style={styles.moderationErrorText}>
                {prohibitedContribution.message}
              </AppText>
            </View>
          ) : contributeError ? (
            <AppText style={styles.sheetFootnote}>{contributeError}</AppText>
          ) : null}
        </>
      ) : null}
    </BottomSheet>
  );
}

function QuickSavedSummary({
  item,
  storageLocationLabel,
}: {
  item: InventoryItem;
  storageLocationLabel: string;
}) {
  const rows = [
    { label: "재료", value: item.displayName },
    { label: "수량", value: formatInventoryQuantity(item) },
    { label: "보관 위치", value: storageLocationLabel },
    {
      label: "유통기한",
      value: item.expiryDate ? formatDateKorean(item.expiryDate) : "기한 확인 필요",
    },
  ];

  return (
    <View
      style={styles.quickSavedCard}
      accessible
      accessibilityLabel={rows
        .map((row) => `${row.label} ${row.value}`)
        .join(", ")}
    >
      {rows.map((row) => (
        <View key={row.label} style={styles.quickSummaryRow}>
          <AppText style={styles.quickSummaryLabel}>{row.label}</AppText>
          <AppText style={styles.quickSummaryValue}>{row.value}</AppText>
        </View>
      ))}
    </View>
  );
}
