import type { LucideIcon } from "lucide-react-native";
import {
  Barcode,
  ChevronRight,
  ImageIcon,
  PenLine,
} from "lucide-react-native";
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "../../components/AppText";
import { BottomSheet } from "../../components/BottomSheet";
import { colors, radius, spacing, controlSize } from "../../shared/theme";
import {
  photoDraftForSpace,
  preferredEntryMethodForSpace,
  type IngredientEntryMethod,
  useRegistrationStore,
} from "../../store/registration-store";
import { useActiveSpace } from "../spaces/space-provider";

type EntryOption = {
  method: IngredientEntryMethod;
  title: string;
  description: string;
  icon: LucideIcon;
  testID: string;
  onPress: () => void;
};

export function IngredientEntryMethodSheet({
  visible,
  onClose,
  onScan,
  onPhoto,
  onManual,
}: {
  visible: boolean;
  onClose: () => void;
  onScan: () => void;
  onPhoto?: () => void;
  onManual: () => void;
}) {
  const { activeSpaceId } = useActiveSpace();
  const preferredMethod = useRegistrationStore((state) =>
    preferredEntryMethodForSpace(state, activeSpaceId),
  );
  const photoDraftCount = useRegistrationStore(
    (state) => photoDraftForSpace(state, activeSpaceId)?.length ?? 0,
  );
  const setPreferredEntryMethod = useRegistrationStore(
    (state) => state.setPreferredEntryMethod,
  );

  const options = useMemo<EntryOption[]>(() => {
    const next: EntryOption[] = [
      {
        method: "scan",
        title: "바코드로 넣기",
        description: "포장 상품 하나를 가장 빠르게 등록해요.",
        icon: Barcode,
        testID: "ingredient-entry-scan-button",
        onPress: onScan,
      },
    ];
    if (onPhoto) {
      next.push({
        method: "photo",
        title: photoDraftCount ? "사진 초안 이어서" : "사진으로 여러 개 넣기",
        description: photoDraftCount
          ? `확인 중인 ${photoDraftCount}개부터 이어서 볼 수 있어요.`
          : "장 본 재료를 한 번에 읽고 필요한 것만 확인해요.",
        icon: ImageIcon,
        testID: "ingredient-entry-photo-button",
        onPress: onPhoto,
      });
    }
    next.push({
      method: "manual",
      title: "직접 입력하기",
      description: "바코드가 없거나 이름만 빠르게 적고 싶을 때 좋아요.",
      icon: PenLine,
      testID: "ingredient-entry-manual-button",
      onPress: onManual,
    });
    return next;
  }, [onManual, onPhoto, onScan, photoDraftCount]);

  const availableMethods = new Set(options.map((option) => option.method));
  const recommendedMethod: IngredientEntryMethod =
    photoDraftCount > 0 && onPhoto
      ? "photo"
      : preferredMethod && availableMethods.has(preferredMethod)
        ? preferredMethod
        : "scan";
  const orderedOptions = [
    ...options.filter((option) => option.method === recommendedMethod),
    ...options.filter((option) => option.method !== recommendedMethod),
  ];

  const choose = (option: EntryOption) => {
    if (activeSpaceId) {
      setPreferredEntryMethod(activeSpaceId, option.method);
    }
    option.onPress();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="어떻게 넣을까요?"
      description="포장 상품은 바코드, 여러 재료는 사진이 빨라요. 최근 방식은 다음에도 먼저 보여드릴게요."
      mascotMood="idle"
    >
      <View style={styles.optionStack}>
        {orderedOptions.map((option) => {
          const recommended = option.method === recommendedMethod;
          const Icon = option.icon;
          const badge =
            option.method === "photo" && photoDraftCount > 0
              ? "초안 이어서"
              : preferredMethod === option.method
                ? "최근 사용"
                : "빠른 등록";
          return (
            <Pressable
              key={option.method}
              onPress={() => choose(option)}
              accessibilityRole="button"
              accessibilityLabel={`${option.title}, ${option.description}`}
              testID={option.testID}
              style={({ pressed }) => [
                styles.option,
                recommended && styles.optionRecommended,
                pressed && styles.optionPressed,
              ]}
            >
              <View
                style={[
                  styles.iconWrap,
                  recommended && styles.iconWrapRecommended,
                ]}
              >
                <Icon
                  color={recommended ? colors.primary : colors.mutedText}
                  size={spacing.lg}
                  strokeWidth={2.4}
                />
              </View>
              <View style={styles.optionCopy}>
                <View style={styles.optionTitleRow}>
                  <AppText variant="bodyStrong">{option.title}</AppText>
                  {recommended ? (
                    <View style={styles.badge}>
                      <AppText variant="caption" tone="primary">
                        {badge}
                      </AppText>
                    </View>
                  ) : null}
                </View>
                <AppText variant="bodySmall" tone="subtext">
                  {option.description}
                </AppText>
              </View>
              <ChevronRight color={colors.mutedText} size={spacing.md} />
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  optionStack: {
    gap: spacing.xs,
  },
  option: {
    minHeight: controlSize.cta,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xxl,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  optionRecommended: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  optionPressed: {
    opacity: 0.84,
  },
  iconWrap: {
    width: controlSize.icon,
    height: controlSize.icon,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
    backgroundColor: colors.mutedSurface,
  },
  iconWrapRecommended: {
    backgroundColor: colors.surface,
  },
  optionCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  optionTitleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.xs,
  },
  badge: {
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
  },
});
