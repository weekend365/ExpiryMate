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
import { Button } from "../../components/Button";
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
        description: "포장 상품 1개",
        icon: Barcode,
        testID: "ingredient-entry-scan-button",
        onPress: onScan,
      },
    ];
    if (onPhoto) {
      next.push({
        method: "photo",
        title: "사진으로 여러 개 넣기",
        description: "여러 재료 한 번에",
        icon: ImageIcon,
        testID: "ingredient-entry-photo-button",
        onPress: onPhoto,
      });
    }
    next.push({
      method: "manual",
      title: "직접 입력하기",
      description: "바코드 없는 재료",
      icon: PenLine,
      testID: "ingredient-entry-manual-button",
      onPress: onManual,
    });
    return next;
  }, [onManual, onPhoto, onScan]);

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
      description="재료에 맞는 방식을 골라 주세요."
      mascotMood="idle"
    >
      <View style={styles.optionStack}>
        {photoDraftCount > 0 && onPhoto ? (
          <View style={styles.draftResume} testID="ingredient-entry-photo-draft">
            <AppText variant="bodySmall" tone="subtext">
              아직 저장하지 않은 사진 초안이 있어요. 새 사진은 초안을 확인한 뒤 선택할 수 있어요.
            </AppText>
            <Button
              variant="secondary"
              fullWidth
              testID="ingredient-entry-resume-photo-button"
              onPress={() => {
                if (activeSpaceId) {
                  setPreferredEntryMethod(activeSpaceId, "photo");
                }
                onPhoto();
              }}
            >
              {`확인 중인 재료 ${photoDraftCount}개 이어서`}
            </Button>
          </View>
        ) : null}
        {options.map((option) => {
          const Icon = option.icon;
          const recentlyUsed = preferredMethod === option.method;
          return (
            <Pressable
              key={option.method}
              onPress={() => choose(option)}
              accessibilityRole="button"
              accessibilityLabel={`${option.title}, ${option.description}${recentlyUsed ? ", 최근 사용" : ""}`}
              accessibilityHint={
                option.method === "photo" && photoDraftCount > 0
                  ? "저장하지 않은 초안을 먼저 확인해요."
                  : undefined
              }
              testID={option.testID}
              style={({ pressed }) => [
                styles.option,
                pressed && styles.optionPressed,
              ]}
            >
              <View style={styles.iconWrap}>
                <Icon
                  color={colors.primaryForeground}
                  size={spacing.lg}
                  strokeWidth={2.4}
                />
              </View>
              <View style={styles.optionCopy}>
                <View style={styles.optionTitleRow}>
                  <AppText variant="bodyStrong" style={styles.optionTitle}>{option.title}</AppText>
                  {recentlyUsed ? (
                    <View style={styles.badge}>
                      <AppText variant="caption" tone="primary">
                        최근 사용
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
    borderColor: colors.borderControl,
    borderRadius: radius.xxl,
    backgroundColor: colors.surfaceWarm,
    padding: spacing.md,
  },
  draftResume: {
    gap: spacing.xs,
    paddingBottom: spacing.sm,
    marginBottom: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
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
  optionTitle: {
    flexShrink: 1,
  },
  badge: {
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
  },
});
