import {
  ProductCategory,
  addDays,
  fieldLimits,
  productCategoryLabels,
  productCategoryOptions,
  toIsoDate,
} from "@expirymate/shared";
import { CalendarDays, ChevronRight, MapPin, Plus } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "../../components/AppText";
import { AppTextInput } from "../../components/AppTextInput";
import { BottomSheet } from "../../components/BottomSheet";
import { Button } from "../../components/Button";
import { FormField } from "../../components/FormField";
import { Pill } from "../../components/Pill";
import {
  colors,
  radius,
  spacing,
  controlSize,
  typography,
} from "../../shared/theme";
import { QUICK_EXPIRY_OPTIONS } from "./inventory-form-copy";

export {
  QUICK_EXPIRY_OPTIONS,
  extraDetailsRowLabel,
  formatPutAwayMessage,
  formatPutAwaySupportingMessage,
  formatUpdatedMessage,
  koreanObjectParticle,
} from "./inventory-form-copy";

export function RecapRow({
  label,
  value,
  onPress,
  hint = "이 내용을 다시 고치러 갈게요.",
}: {
  label: string;
  value: string;
  onPress: () => void;
  hint?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${value}`}
      accessibilityHint={hint}
      style={({ pressed }) => [
        recapRowStyles.row,
        pressed && recapRowStyles.rowPressed,
      ]}
    >
      <View style={recapRowStyles.copy}>
        <AppText style={recapRowStyles.label}>{label}</AppText>
        <AppText style={recapRowStyles.value}>
          {value}
        </AppText>
      </View>
      <ChevronRight
        color={colors.mutedText}
        size={spacing.md}
        strokeWidth={2.4}
      />
    </Pressable>
  );
}

export function RecapCard({ children }: { children: ReactNode }) {
  return (
    <View
      style={[inventoryFormStyles.sectionCard, inventoryFormStyles.sectionCardTight]}
    >
      <View style={inventoryFormStyles.sectionHeading}>
        <AppText style={inventoryFormStyles.sectionTitle}>넣은 내용</AppText>
        <AppText style={inventoryFormStyles.sectionCaption}>
          이름·양·자리는 눌러서 고쳐요
        </AppText>
      </View>
      <View style={inventoryFormStyles.recapList}>{children}</View>
    </View>
  );
}

export function QuickExpiryPills({
  isSelected,
  onSelect,
  showCaption = true,
}: {
  isSelected: (isoDate: string) => boolean;
  onSelect: (isoDate: string) => void;
  showCaption?: boolean;
}) {
  const pills = (
    <View style={inventoryFormStyles.pillRow}>
      {QUICK_EXPIRY_OPTIONS.map((option) => {
        const presetDate = toIsoDate(addDays(new Date(), option.days));

        return (
          <Pill
            key={option.days}
            label={option.label}
            icon={CalendarDays}
            selected={isSelected(presetDate)}
            onPress={() => onSelect(presetDate)}
          />
        );
      })}
    </View>
  );

  if (!showCaption) {
    return pills;
  }

  return (
    <View style={inventoryFormStyles.expiryPresetBlock}>
      <AppText style={inventoryFormStyles.sectionCaption}>빠른 기간</AppText>
      {pills}
    </View>
  );
}

export function StorageLocationField({
  expanded,
  selectedKey,
  selectedLabel,
  options,
  onExpand,
  onSelect,
  onAddLocation,
}: {
  expanded: boolean;
  selectedKey: string;
  selectedLabel: string;
  options: Array<{ key: string; label: string }>;
  onExpand: () => void;
  onSelect: (key: string) => void;
  onAddLocation: () => void;
}) {
  if (expanded) {
    return (
      <View
        style={[
          inventoryFormStyles.sectionCard,
          inventoryFormStyles.sectionCardCompact,
        ]}
      >
        <AppText style={inventoryFormStyles.sectionTitle}>어디에 두나요?</AppText>
        <View style={inventoryFormStyles.pillRow}>
          {options.map((option) => (
            <Pill
              key={option.key}
              label={option.label}
              icon={MapPin}
              selected={selectedKey === option.key}
              onPress={() => onSelect(option.key)}
            />
          ))}
          <Pill
            label="위치 추가"
            icon={Plus}
            selected={false}
            onPress={onAddLocation}
          />
        </View>
      </View>
    );
  }

  return (
    <Pressable
      onPress={onExpand}
      accessibilityRole="button"
      accessibilityLabel={`보관 위치 변경, 현재 ${selectedLabel}`}
      accessibilityHint="자리를 다른 곳으로 바꿀 수 있어요."
      style={({ pressed }) => [
        inventoryFormStyles.sectionCard,
        inventoryFormStyles.sectionCardRow,
        pressed && inventoryFormStyles.sectionCardPressed,
      ]}
    >
      <AppText style={inventoryFormStyles.sectionTitle}>보관 자리</AppText>
      <MapPin color={colors.mutedText} size={spacing.sm} strokeWidth={2.4} />
      <AppText style={inventoryFormStyles.locationRowLabel}>
        {selectedLabel}
      </AppText>
      <AppText style={inventoryFormStyles.locationRowAction}>변경</AppText>
    </Pressable>
  );
}

export function ExtraDetailsRow({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="브랜드, 카테고리, 메모는 필요할 때만 적어도 돼요."
      style={({ pressed }) => [
        inventoryFormStyles.sectionCard,
        inventoryFormStyles.sectionCardRow,
        pressed && inventoryFormStyles.sectionCardPressed,
      ]}
    >
      <AppText style={inventoryFormStyles.sectionTitle}>브랜드·메모</AppText>
      <AppText style={inventoryFormStyles.locationRowLabel}>
        {label}
      </AppText>
      <ChevronRight
        color={colors.mutedText}
        size={spacing.md}
        strokeWidth={2.4}
      />
    </Pressable>
  );
}

export function AdditionalInfoSheet({
  visible,
  onClose,
  control,
  category,
  onSelectCategory,
}: {
  visible: boolean;
  onClose: () => void;
  control: any;
  category?: ProductCategory;
  onSelectCategory: (value: ProductCategory) => void;
}) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      mascotMood="idle"
      title="조금만 더 알려주세요"
      description="브랜드와 메모는 필요할 때만 적어도 돼요."
      footer={
        <Button onPress={onClose} fullWidth>
          완료
        </Button>
      }
    >
      <FormField
        control={control}
        name="brand"
        label="브랜드"
        placeholder="예: 서울우유"
      />
      <View style={inventoryFormStyles.extraSection}>
        <AppText style={inventoryFormStyles.extraSectionTitle}>카테고리</AppText>
        <View style={inventoryFormStyles.pillRow}>
          {productCategoryOptions.map((option) => (
            <Pill
              key={option.value}
              label={option.label}
              selected={category === option.value}
              onPress={() => onSelectCategory(option.value as ProductCategory)}
            />
          ))}
        </View>
        {category ? (
          <AppText style={inventoryFormStyles.inlineMetaValue}>
            지금 선택: {productCategoryLabels[category]}
          </AppText>
        ) : null}
      </View>
      <FormField
        control={control}
        name="notes"
        label="메모"
        placeholder="기억해 둘 말이 있으면 적어 주세요"
        multiline
      />
    </BottomSheet>
  );
}

export function AddLocationSheet({
  visible,
  onClose,
  label,
  onChangeLabel,
  onSubmit,
  loading,
}: {
  visible: boolean;
  onClose: () => void;
  label: string;
  onChangeLabel: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
}) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="어디에 둘까요?"
      description="위치 이름을 알려 주시면 목록에 넣어 둘게요."
      mascotMood="idle"
      footer={
        <Button
          onPress={onSubmit}
          loading={loading}
          disabled={label.trim().length === 0}
          fullWidth
        >
          위치 추가
        </Button>
      }
    >
      <View style={inventoryFormStyles.addLocationField}>
        <AppText style={inventoryFormStyles.addLocationLabel}>위치 이름</AppText>
        <AppTextInput
          value={label}
          onChangeText={onChangeLabel}
          placeholder="예: 팬트리"
          maxLength={fieldLimits.storageLocationLabel}
          autoFocus
          style={inventoryFormStyles.addLocationInput}
        />
      </View>
    </BottomSheet>
  );
}

const recapRowStyles = StyleSheet.create({
  row: {
    minHeight: controlSize.minimum,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.lg,
    backgroundColor: colors.mutedSurface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  rowPressed: {
    backgroundColor: colors.surfacePressed,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  label: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.mutedText,
  },
  value: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
});

export const inventoryFormStyles = StyleSheet.create({
  addLocationField: {
    gap: spacing.xs,
  },
  addLocationLabel: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.text,
  },
  addLocationInput: {
    minHeight: controlSize.cta,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderControl,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.body.fontFamily,
  },
  stepSections: {
    gap: spacing.sm,
  },
  screenSections: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  sectionCardSoft: {
    backgroundColor: colors.primarySoft,
  },
  sectionCardPadded: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionCardCompact: {
    padding: spacing.sm,
    gap: spacing.sm,
  },
  sectionCardTight: {
    padding: spacing.sm,
    gap: spacing.xs,
  },
  sectionCardRow: {
    minHeight: controlSize.minimum,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  sectionCardPressed: {
    backgroundColor: colors.surfacePressed,
  },
  sectionTitle: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  sectionHeading: {
    gap: spacing.xxs,
  },
  sectionCaption: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.caption.fontFamily,
    color: colors.mutedText,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  inlineMetaValue: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.text,
  },
  expiryPresetBlock: {
    gap: spacing.xs,
  },
  unitChipBlock: {
    gap: spacing.xs,
  },
  locationRowLabel: {
    flex: 1,
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.subtext,
  },
  locationRowAction: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.primaryForeground,
  },
  recapList: {
    gap: spacing.xs,
  },
  footerStack: {
    gap: spacing.sm,
  },
  ctaHint: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.mutedText,
    textAlign: "center",
  },
  extraSection: {
    gap: spacing.sm,
  },
  extraSectionTitle: {
    fontSize: typography.bodySmall.fontSize,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
});
