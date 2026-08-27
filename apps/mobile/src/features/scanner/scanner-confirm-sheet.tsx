import {
  type ExpirySource,
  ProductCategory,
  productCategoryLabels,
  productCategoryOptions,
} from "@expirymate/shared";
import { CheckCircle2, Package, RotateCcw } from "lucide-react-native";
import { Image, View } from "react-native";
import { BottomSheet } from "../../components/BottomSheet";
import { Button } from "../../components/Button";
import { AppText } from "../../components/AppText";
import { AppTextInput } from "../../components/AppTextInput";
import { type MascotMood } from "../../components/Mascot";
import { Pill } from "../../components/Pill";
import { colors, spacing } from "../../shared/theme";
import type { BarcodeContributionField } from "./barcodeContributionModeration";
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
  isContributing,
  contributeError,
  prohibitedContribution,
  onClose,
  onRescan,
  onUseScanResult,
  onContinueWithoutContribution,
  onCatalogNameAccepted,
  onManualNameChange,
  onManualBrandChange,
  onManualCategoryChange,
  onPresetExpiry,
  onManualExpiryChange,
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
  resolvedExpiryDate: string;
  isContributing: boolean;
  contributeError: string | null;
  prohibitedContribution: {
    fields: BarcodeContributionField[];
    message: string;
  } | null;
  onClose: () => void;
  onRescan: () => void;
  onUseScanResult: () => void;
  onContinueWithoutContribution: () => void;
  onCatalogNameAccepted: (accepted: boolean) => void;
  onManualNameChange: (value: string) => void;
  onManualBrandChange: (value: string) => void;
  onManualCategoryChange: (value: ProductCategory) => void;
  onPresetExpiry: (days: number) => void;
  onManualExpiryChange: (value: string) => void;
}) {
  return (
    <BottomSheet
      visible={Boolean(confirmation)}
      onClose={onClose}
      dismissible={false}
      mascotMood={resultMood}
      title={
        needsManualName
          ? "이 재료 이름을 알려줄래요?"
          : !catalogNameAccepted
            ? "우리 집에서는 뭐라고 부를까요?"
            : needsManualExpiry
              ? "유통기한은 언제까지인가요?"
              : needsNameConfirmation
                ? "한 번만 확인해 주세요"
                : "이걸로 넣을까요?"
      }
      description={
        needsManualName && needsManualExpiry
          ? "목록에서 못 찾았어요. 이름과 유통기한을 알려주시면 양만 맞춰 넣을게요."
          : needsManualExpiry
            ? "날짜가 안 보여도 괜찮아요. 직접 골라 주시면 양만 맞춰 넣을게요."
            : needsManualName
              ? "목록에서 못 찾았어요. 이름만 알려주시면 양 맞추는 화면으로 이어갈게요."
              : !catalogNameAccepted
                ? "목록 이름은 그대로 두고, 냉장고에는 지금 이름으로 넣을게요."
                : needsNameConfirmation
                  ? "이 이름은 아직 덜 확실해요. 맞으면 그대로, 다르면 냉장고에 넣을 이름으로 바꿔 주세요."
                  : "목록에서 찾은 이름이에요. 맞으면 양만 맞춰 넣을게요."
      }
      footer={
        <View style={styles.sheetFooter}>
          {needsManualExpiry && !resolvedExpiryDate ? (
            <AppText style={styles.ctaHint} accessibilityLiveRegion="polite">
              날짜만 골라 주시면 넣을게요
            </AppText>
          ) : null}
          <Button
            variant="secondary"
            icon={RotateCcw}
            onPress={onRescan}
            disabled={isContributing}
            fullWidth
          >
            다시 스캔할게요
          </Button>
          {prohibitedContribution ? (
            <Button
              variant="secondary"
              onPress={onContinueWithoutContribution}
              disabled={isContributing}
              fullWidth
            >
              기여 없이 계속 등록
            </Button>
          ) : null}
          <Button
            icon={CheckCircle2}
            iconPosition="right"
            onPress={onUseScanResult}
            disabled={
              !resolvedProductName ||
              !resolvedExpiryDate ||
              isContributing ||
              productLookupStatus === "loading"
            }
            loading={isContributing || productLookupStatus === "loading"}
            fullWidth
          >
            {prohibitedContribution ? "수정 후 다시 시도" : "양만 맞출게요"}
          </Button>
        </View>
      }
    >
      {confirmation ? (
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
                <Package color={colors.primary} size={spacing.md} strokeWidth={2.4} />
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
                  이름이 다르면 다음 화면에서 바꿔 주세요.
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

          {needsManualExpiry ? (
            <ManualExpirySection
              expiryDate={manualExpiryDate}
              expirySource={manualExpirySource}
              onPreset={onPresetExpiry}
              onManualChange={onManualExpiryChange}
            />
          ) : (
            <View style={styles.expiryCard}>
              <AppText style={styles.expiryLabel}>읽은 유통기한</AppText>
              <AppText style={styles.expiryValue}>
                {confirmation.expirationDate}
              </AppText>
            </View>
          )}

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
