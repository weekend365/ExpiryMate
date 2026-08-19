import {
  calculateDaysLeftUntilExpiry,
  formatDateKoreanCompact,
  formatInventoryQuantity,
  getExpiryTrafficBucket,
  resolveStorageLocationLabel,
  type InventoryItem,
} from "@expirymate/shared";
import { Check, PenLine } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, radius, spacing, touchTarget, typography } from "../shared/theme";
import { useResponsiveLayout } from "../shared/responsive-layout";
import { AppText } from "./AppText";

/** Visual lamp size — card press owns the touch target, so this can be under 48. */
const HERO_LAMP_SIZE = spacing.xl;

interface InventoryCardProps {
  item: InventoryItem;
  onPress: (item: InventoryItem) => void;
  onLongPress?: (item: InventoryItem) => void;
  onEdit?: (item: InventoryItem) => void;
  selectionMode?: boolean;
  selected?: boolean;
  resolveLocationLabel?: (key: string) => string;
}

export function InventoryCard({
  item,
  onPress,
  onLongPress,
  onEdit,
  selectionMode = false,
  selected = false,
  resolveLocationLabel = resolveStorageLocationLabel,
}: InventoryCardProps) {
  const { shouldStack, isRegular } = useResponsiveLayout();
  const presentation = getExpiryLampPresentation(item.expiryDate);
  const locationLabel = resolveLocationLabel(item.storageLocation);
  const quantityLabel = formatInventoryQuantity(item);
  const dateLabel = `${formatDateKoreanCompact(item.expiryDate)}까지`;
  const accessibilityLabel = `${item.displayName}, ${presentation.ddayLabel}, ${locationLabel}, ${quantityLabel}, ${dateLabel}`;

  return (
    <View
      style={[
        styles.card,
        selected && styles.cardSelected,
        isRegular && styles.cardRegular,
      ]}
    >
      <Pressable
        onPress={() => onPress(item)}
        onLongPress={() => onLongPress?.(item)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={
          selectionMode
            ? selected
              ? "선택됨. 다시 누르면 선택을 해제해요."
              : "누르면 정리할 재료로 골라요."
            : "누르면 모두 정리할지, 일부만 뺄지 고를 수 있어요."
        }
        accessibilityState={selectionMode ? { selected } : undefined}
        style={({ pressed }) => [
          styles.main,
          shouldStack && styles.mainStacked,
          pressed && styles.pressed,
        ]}
      >
        <ExpiryBadge
          ddayLabel={presentation.ddayLabel}
          lampColor={presentation.lampColor}
        />
        <View style={styles.copy}>
          <AppText
            variant="bodyStrong"
            numberOfLines={1}
            ellipsizeMode="tail"
            style={styles.name}
          >
            {item.displayName}
            {item.brand ? (
              <AppText variant="caption" tone="muted">
                {" "}
                · {item.brand}
              </AppText>
            ) : null}
          </AppText>
          <AppText variant="caption" tone="subtext" numberOfLines={1} style={styles.meta}>
            {locationLabel} · {quantityLabel} · {dateLabel}
          </AppText>
        </View>
      </Pressable>

      {selectionMode ? (
        <Pressable
          onPress={() => onPress(item)}
          accessibilityRole="button"
          accessibilityLabel={selected ? "선택 해제" : "이 재료 고르기"}
          style={styles.trailingHit}
        >
          <View
            style={[
              styles.selectionIndicator,
              selected && styles.selectionIndicatorSelected,
            ]}
          >
            {selected ? (
              <Check
                color={colors.primary}
                size={spacing.md}
                strokeWidth={2.6}
              />
            ) : null}
          </View>
        </Pressable>
      ) : onEdit ? (
        <Pressable
          onPress={() => onEdit(item)}
          hitSlop={spacing.xs}
          accessibilityRole="button"
          accessibilityLabel={`${item.displayName} 내용을 고칠게요`}
          accessibilityHint="이름, 수량, 유통기한을 다시 맞춰 둘 수 있어요."
          style={({ pressed }) => [
            styles.trailingHit,
            pressed && styles.pressed,
          ]}
        >
          <PenLine
            color={colors.subtext}
            size={spacing.sm + spacing.xxs}
            strokeWidth={2.4}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

function ExpiryBadge({
  ddayLabel,
  lampColor,
}: {
  ddayLabel: string;
  lampColor: string;
}) {
  return (
    <View
      style={[styles.expiryLamp, { backgroundColor: lampColor }]}
      accessibilityLabel={ddayLabel}
    >
      <AppText
        variant="caption"
        scaleRole="chrome"
        densityAware={false}
        style={styles.expiryLampText}
      >
        {ddayLabel}
      </AppText>
    </View>
  );
}

function getExpiryLampPresentation(expiryDate: string) {
  const bucket = getExpiryTrafficBucket(expiryDate);
  const daysLeft = calculateDaysLeftUntilExpiry(expiryDate);
  const ddayLabel =
    daysLeft < 0
      ? `D+${Math.abs(daysLeft)}`
      : daysLeft === 0
        ? "오늘"
        : `D-${daysLeft}`;

  const lampColor = {
    expired: colors.danger,
    within_7_days: colors.warning,
    safe: colors.success,
  }[bucket];

  return { lampColor, ddayLabel };
}

const styles = StyleSheet.create({
  card: {
    minHeight: touchTarget.cta,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  cardRegular: {
    flexGrow: 1,
    flexBasis: "40%",
    maxWidth: "48%",
  },
  main: {
    flex: 1,
    minWidth: 0,
    minHeight: touchTarget.cta,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  mainStacked: {
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  pressed: {
    backgroundColor: colors.surfacePressed,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  name: {
    flexShrink: 1,
    minWidth: 0,
  },
  meta: {
    flexShrink: 1,
  },
  trailingHit: {
    minWidth: touchTarget.icon,
    minHeight: touchTarget.cta,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
  },
  expiryLamp: {
    width: HERO_LAMP_SIZE,
    height: HERO_LAMP_SIZE,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  expiryLampText: {
    fontFamily: typography.title.fontFamily,
    color: colors.surface,
  },
  selectionIndicator: {
    width: spacing.lg,
    height: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  selectionIndicatorSelected: {
    borderWidth: 0,
    backgroundColor: "transparent",
  },
});
