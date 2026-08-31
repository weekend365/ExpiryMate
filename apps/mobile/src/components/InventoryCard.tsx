import {
  calculateDaysLeftUntilExpiry,
  formatDateKoreanCompact,
  formatInventoryQuantity,
  getExpiryTrafficBucket,
  resolveStorageLocationLabel,
  type InventoryItem,
} from "@expirymate/shared";
import { Check, CircleMinus } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, radius, spacing, controlSize, typography } from "../shared/theme";
import { useResponsiveLayout } from "../shared/responsive-layout";
import { AppText } from "./AppText";

/** Visual lamp size — card press owns the touch target, so this can be under 48. */
const HERO_LAMP_SIZE = spacing.xl;

interface InventoryCardProps {
  item: InventoryItem;
  onPress: (item: InventoryItem) => void;
  onLongPress?: (item: InventoryItem) => void;
  onCleanup?: (item: InventoryItem) => void;
  selectionMode?: boolean;
  selected?: boolean;
  /** Flush row inside a section surface — no own card chrome. */
  embedded?: boolean;
  showDivider?: boolean;
  resolveLocationLabel?: (key: string) => string;
}

export function InventoryCard({
  item,
  onPress,
  onLongPress,
  onCleanup,
  selectionMode = false,
  selected = false,
  embedded = false,
  showDivider = false,
  resolveLocationLabel = resolveStorageLocationLabel,
}: InventoryCardProps) {
  const { shouldStack } = useResponsiveLayout();
  const presentation = getExpiryLampPresentation(item.expiryDate);
  const locationLabel = resolveLocationLabel(item.storageLocation);
  const quantityLabel = formatInventoryQuantity(item);
  const dateLabel = item.expiryDate
    ? `${formatDateKoreanCompact(item.expiryDate)}까지`
    : "기한 확인 필요";
  const accessibilityLabel = `${item.displayName}, ${presentation.ddayLabel}, ${locationLabel}, ${quantityLabel}, ${dateLabel}`;

  return (
    <View
      style={[
        styles.card,
        embedded && styles.cardEmbedded,
        selected && (embedded ? styles.cardEmbeddedSelected : styles.cardSelected),
        showDivider && styles.cardDivider,
        shouldStack && styles.cardStacked,
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
            : "누르면 바꿀 내용을 고를 수 있어요."
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
            numberOfLines={shouldStack ? undefined : 1}
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
          <AppText
            variant="caption"
            tone="subtext"
            numberOfLines={shouldStack ? undefined : 1}
            style={styles.meta}
          >
            {locationLabel} · {quantityLabel} · {dateLabel}
          </AppText>
        </View>
      </Pressable>

      {selectionMode ? (
        <Pressable
          onPress={() => onPress(item)}
          accessibilityRole="button"
          accessibilityLabel={selected ? "선택 해제" : "이 재료 고르기"}
          style={[styles.trailingHit, shouldStack && styles.trailingHitStacked]}
        >
          <View
            style={[
              styles.selectionIndicator,
              selected && styles.selectionIndicatorSelected,
            ]}
          >
            {selected ? (
              <Check
                color={colors.primaryForeground}
                size={spacing.md}
                strokeWidth={2.6}
              />
            ) : null}
          </View>
        </Pressable>
      ) : onCleanup ? (
        <Pressable
          onPress={() => onCleanup(item)}
          testID="inventory-item-cleanup-button"
          hitSlop={spacing.xs}
          accessibilityRole="button"
          accessibilityLabel={`${item.displayName} 사용량 반영`}
          accessibilityHint="전부 사용했는지 일부만 사용했는지 고를 수 있어요."
          style={({ pressed }) => [
            styles.trailingHit,
            shouldStack && styles.trailingHitStacked,
            pressed && styles.pressed,
          ]}
        >
          <CircleMinus
            color={colors.primaryForeground}
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

function getExpiryLampPresentation(expiryDate: string | null) {
  if (!expiryDate) {
    return { lampColor: colors.mutedText, ddayLabel: "확인" };
  }

  const bucket = getExpiryTrafficBucket(expiryDate);
  const daysLeft = calculateDaysLeftUntilExpiry(expiryDate);
  const ddayLabel =
    daysLeft < 0
      ? `D+${Math.abs(daysLeft)}`
      : daysLeft === 0
        ? "오늘"
        : `D-${daysLeft}`;

  const lampColor = {
    unknown: colors.mutedText,
    expired: colors.dangerForeground,
    within_7_days: colors.warningForeground,
    safe: colors.successForeground,
  }[bucket];

  return { lampColor, ddayLabel };
}

const styles = StyleSheet.create({
  card: {
    minHeight: controlSize.cta,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  cardEmbedded: {
    borderWidth: 0,
    borderRadius: radius.none,
    backgroundColor: colors.surface,
  },
  cardStacked: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  cardSelected: {
    borderColor: colors.primaryForeground,
    backgroundColor: colors.primarySoft,
  },
  cardEmbeddedSelected: {
    backgroundColor: colors.primarySoft,
  },
  cardDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  main: {
    flex: 1,
    minWidth: 0,
    minHeight: controlSize.cta,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  mainStacked: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: spacing.xs,
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
    minWidth: controlSize.icon,
    minHeight: controlSize.cta,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
  },
  trailingHitStacked: {
    alignSelf: "flex-end",
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
