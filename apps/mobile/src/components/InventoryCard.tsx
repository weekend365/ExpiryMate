import {
  calculateDaysLeftUntilExpiry,
  formatDateKoreanCompact,
  formatInventoryQuantity,
  getExpiryTrafficBucket,
  resolveStorageLocationLabel,
  type InventoryItem,
} from "@expirymate/shared";
import { Check, Ellipsis, Minus } from "lucide-react-native";
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
  onQuickUse?: (item: InventoryItem) => void;
  onOpenMore?: (item: InventoryItem) => void;
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
  onQuickUse,
  onOpenMore,
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
  const dateLabel = `${formatDateKoreanCompact(item.expiryDate)}까지`;
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
            : "누르면 이 재료의 상세 내용과 수정 화면을 열어요."
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
            {quantityLabel} · {locationLabel} · {dateLabel}
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
                color={colors.primary}
                size={spacing.md}
                strokeWidth={2.6}
              />
            ) : null}
          </View>
        </Pressable>
      ) : onQuickUse || onOpenMore ? (
        <View
          style={[
            styles.trailingActions,
            shouldStack && styles.trailingActionsStacked,
          ]}
        >
          {onQuickUse ? (
            <Pressable
              onPress={() => onQuickUse(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.displayName} 사용한 양 빼기`}
              accessibilityHint="모두 썼는지 일부만 썼는지 고를 수 있어요."
              style={({ pressed }) => [
                styles.quickUseButton,
                pressed && styles.pressed,
              ]}
              testID={`inventory-quick-use-${item.id}`}
            >
              <Minus
                color={colors.primary}
                size={spacing.sm}
                strokeWidth={2.4}
              />
              <AppText
                variant="bodySmallStrong"
                scaleRole="chrome"
                densityAware={false}
                tone="primary"
              >
                사용
              </AppText>
            </Pressable>
          ) : null}
          {onOpenMore ? (
            <Pressable
              onPress={() => onOpenMore(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.displayName} 더보기`}
              accessibilityHint="폐기하거나 여러 개 정리하는 메뉴를 열어요."
              style={({ pressed }) => [
                styles.moreButton,
                pressed && styles.pressed,
              ]}
              testID={`inventory-more-${item.id}`}
            >
              <Ellipsis
                color={colors.subtext}
                size={spacing.sm + spacing.xxs}
                strokeWidth={2.4}
              />
            </Pressable>
          ) : null}
        </View>
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
    borderColor: colors.primary,
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
    minHeight: touchTarget.cta,
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
    minWidth: touchTarget.icon,
    minHeight: touchTarget.cta,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
  },
  trailingHitStacked: {
    alignSelf: "flex-end",
  },
  trailingActions: {
    minHeight: touchTarget.cta,
    marginRight: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
  },
  trailingActionsStacked: {
    alignSelf: "flex-end",
    marginBottom: spacing.xs,
  },
  quickUseButton: {
    minWidth: touchTarget.icon,
    minHeight: touchTarget.min,
    paddingHorizontal: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxs,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
  },
  moreButton: {
    minWidth: touchTarget.icon,
    minHeight: touchTarget.min,
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
