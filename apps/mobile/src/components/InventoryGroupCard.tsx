import {
  calculateDaysLeftUntilExpiry,
  formatDateKoreanCompact,
  formatInventoryQuantity,
  getExpiryTrafficBucket,
  resolveStorageLocationLabel,
  type InventoryItem,
  type InventoryItemGroup,
} from "@expirymate/shared";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MoreVertical,
} from "lucide-react-native";
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, touchTarget, typography } from "../shared/theme";
import { useResponsiveLayout } from "../shared/responsive-layout";
import { AppText } from "./AppText";

/** Visual hero size — card press owns the touch target, so this can be under 48. */
const HERO_LAMP_SIZE = spacing.xl;
/** Nested lot lamp — smaller than the collapsed hero so lots stay secondary. */
const LOT_LAMP_SIZE = spacing.lg;

interface InventoryGroupCardProps {
  group: InventoryItemGroup;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onItemPress: (item: InventoryItem) => void;
  onItemLongPress?: (item: InventoryItem) => void;
  /** Opens the cleanup sheet (all / partial) for one lot. */
  onItemCleanup?: (item: InventoryItem) => void;
  selectionMode?: boolean;
  selectedIds?: ReadonlySet<string>;
  resolveLocationLabel?: (key: string) => string;
}

export function InventoryGroupCard({
  group,
  expanded,
  onExpandedChange,
  onItemPress,
  onItemLongPress,
  onItemCleanup,
  selectionMode = false,
  selectedIds,
  resolveLocationLabel = resolveStorageLocationLabel,
}: InventoryGroupCardProps) {
  const { shouldStack } = useResponsiveLayout();
  const isExpandable = group.items.length > 1;
  const showLots = selectionMode || expanded;
  const nearestItem = group.items[0]!;
  const lotCount = group.items.length;

  const quantityLabel = group.hasMixedUnits
    ? `보관 기록 ${lotCount}건`
    : `총 ${group.totalQuantity}${group.unit ?? "개"}`;
  const locationLabel = getGroupLocationLabel(group.items, resolveLocationLabel);

  const handleSummaryPress = () => {
    if (selectionMode) {
      return;
    }

    // One tap → imminent lot detail (do not expand).
    onItemPress(nearestItem);
  };

  const handleToggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
    onExpandedChange(!expanded);
  };

  const nearestPresentation = getExpiryLampPresentation(
    group.nearestExpiryDate,
  );

  const summaryLabel = `${group.displayName}, ${nearestPresentation.ddayLabel}${isExpandable ? `, ${lotCount}건` : ""}, ${locationLabel}, ${quantityLabel}`;
  const summaryCopy = (
    <View style={styles.summaryCopy}>
      <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
        {group.displayName}
        {group.brand ? (
          <Text style={styles.brandInline}> · {group.brand}</Text>
        ) : null}
      </Text>
      {showLots ? null : (
        <Text style={styles.groupMeta}>
          {locationLabel} · {quantityLabel}
        </Text>
      )}
    </View>
  );

  return (
    <View style={styles.card}>
      <View style={styles.summaryRow}>
        {showLots ? (
          <View
            style={[
              styles.summaryMain,
              shouldStack && styles.summaryMainStacked,
            ]}
            accessibilityRole="header"
            accessibilityLabel={summaryLabel}
          >
            {summaryCopy}
          </View>
        ) : (
          <Pressable
            onPress={handleSummaryPress}
            onLongPress={() => onItemLongPress?.(nearestItem)}
            accessibilityRole="button"
            accessibilityLabel={summaryLabel}
            accessibilityHint="누르면 자세히 살펴볼 수 있어요. 더보기로 정리할 수도 있어요."
            style={({ pressed }) => [
              styles.summaryMain,
              shouldStack && styles.summaryMainStacked,
              pressed && styles.summaryPressed,
            ]}
          >
            <ExpiryBadge expiryDate={group.nearestExpiryDate} size="hero" />
            {summaryCopy}
          </Pressable>
        )}

        <View style={styles.summaryActions}>
          {!selectionMode && onItemCleanup && !isExpandable ? (
            <CleanupMenuButton
              label={`${group.displayName} 정리할게요`}
              onPress={() => onItemCleanup(nearestItem)}
            />
          ) : null}

          {isExpandable && !selectionMode ? (
            <Pressable
              onPress={handleToggleExpand}
              hitSlop={spacing.xs}
              accessibilityRole="button"
              accessibilityLabel={
                showLots ? "접을게요" : `${lotCount}건 더 보기`
              }
              accessibilityHint={
                showLots
                  ? "유통기한별 목록을 접어요."
                  : "다른 유통기한 기록을 펼쳐 볼 수 있어요."
              }
              accessibilityState={{ expanded: showLots }}
              style={({ pressed }) => [
                styles.moreButton,
                pressed && styles.summaryPressed,
              ]}
            >
              <AppText
                variant="caption"
                scaleRole="chrome"
                densityAware={false}
                numberOfLines={1}
              >
                {showLots ? "접기" : `${lotCount}건 더`}
              </AppText>
              {showLots ? (
                <ChevronUp
                  color={colors.text}
                  size={typography.caption.fontSize}
                  strokeWidth={2.4}
                />
              ) : (
                <ChevronDown
                  color={colors.text}
                  size={typography.caption.fontSize}
                  strokeWidth={2.4}
                />
              )}

            </Pressable>
          ) : null}
        </View>
      </View>

      {showLots ? (
        <View style={styles.lotWell}>
          {group.items.map((item, index) => {
            const selected = selectedIds?.has(item.id) ?? false;
            const isNearest = index === 0;
            const lotExpiry = getExpiryLampPresentation(item.expiryDate);

            return (
              <View
                key={item.id}
                style={[
                  styles.lotCard,
                  shouldStack && styles.lotCardStacked,
                  selected && styles.lotCardSelected,
                ]}
              >
                <Pressable
                  onPress={() => onItemPress(item)}
                  onLongPress={() => onItemLongPress?.(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`${lotExpiry.ddayLabel}, ${formatDateKoreanCompact(item.expiryDate)}, ${resolveLocationLabel(item.storageLocation)}, ${formatInventoryQuantity(item)}${isNearest && isExpandable ? ", 가장 임박" : ""}`}
                  accessibilityHint={
                    selectionMode
                      ? selected
                        ? "선택됨. 다시 누르면 선택을 해제해요."
                        : "누르면 정리할 재료로 골라요."
                      : "누르면 자세히 살펴볼 수 있어요. 더보기로 정리할 수도 있어요."
                  }
                  accessibilityState={
                    selectionMode ? { selected } : undefined
                  }
                  style={({ pressed }) => [
                    styles.lotMain,
                    pressed && styles.lotCardPressed,
                  ]}
                >
                  <ExpiryBadge expiryDate={item.expiryDate} size="compact" />
                  <View style={styles.lotCopy}>
                    <Text style={styles.lotDate}>
                      {formatDateKoreanCompact(item.expiryDate)}
                    </Text>
                    <Text style={styles.lotMeta}>
                      {resolveLocationLabel(item.storageLocation)} ·{" "}
                      {formatInventoryQuantity(item)}
                    </Text>
                  </View>
                </Pressable>

                {selectionMode ? (
                  <Pressable
                    onPress={() => onItemPress(item)}
                    accessibilityRole="button"
                    accessibilityLabel={
                      selected ? "선택 해제" : "이 재료 고르기"
                    }
                    style={styles.selectionHit}
                  >
                    <View
                      style={[
                        styles.selectionIndicator,
                        selected && styles.selectionIndicatorSelected,
                      ]}
                    >
                      {selected ? (
                        <CheckCircle2
                          color={colors.surface}
                          size={spacing.sm}
                          strokeWidth={2.4}
                        />
                      ) : null}
                    </View>
                  </Pressable>
                ) : onItemCleanup ? (
                  <CleanupMenuButton
                    label={`${formatDateKoreanCompact(item.expiryDate)} 재료 정리할게요`}
                    onPress={() => onItemCleanup(item)}
                  />
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function CleanupMenuButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={spacing.xs}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="전부 정리할지, 일부만 뺄지 고를 수 있어요."
      style={({ pressed }) => [
        styles.cleanupMenuButton,
        pressed && styles.summaryPressed,
      ]}
    >
      <MoreVertical
        color={colors.subtext}
        size={spacing.sm + spacing.xxs}
        strokeWidth={2.4}
      />
    </Pressable>
  );
}

function getGroupLocationLabel(
  items: InventoryItem[],
  resolveLocationLabel: (key: string) => string,
): string {
  const locations = new Set(
    items.map((item) => item.storageLocation),
  );

  if (locations.size === 1) {
    return resolveLocationLabel([...locations][0]!);
  }

  return "여러 위치";
}

function ExpiryBadge({
  expiryDate,
  size = "default",
}: {
  expiryDate: string;
  size?: "default" | "hero" | "compact";
}) {
  const presentation = getExpiryLampPresentation(expiryDate);
  const isHero = size === "hero";
  const isCompact = size === "compact";

  return (
    <View
      style={[
        styles.expiryLamp,
        isCompact
          ? styles.expiryLampCompact
          : isHero
            ? styles.expiryLampHero
            : styles.expiryLampDefault,
        { backgroundColor: presentation.lampColor },
      ]}
      accessibilityLabel={presentation.ddayLabel}
    >
      <AppText
        variant="caption"
        scaleRole="chrome"
        densityAware={false}
        style={styles.expiryLampText}
      >
        {presentation.ddayLabel}
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
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  summaryRow: {
    minHeight: touchTarget.cta,
    flexDirection: "row",
    alignItems: "center",
  },
  summaryMain: {
    flex: 1,
    minWidth: 0,
    minHeight: touchTarget.cta,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  summaryMainStacked: {
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  summaryPressed: {
    backgroundColor: colors.surfacePressed,
  },
  summaryCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  name: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: typography.bodyStrong.fontSize,
    lineHeight: typography.bodyStrong.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  brandInline: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.caption.fontFamily,
    color: colors.mutedText,
  },
  groupMeta: {
    flexShrink: 1,
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.caption.fontFamily,
    color: colors.subtext,
  },
  summaryActions: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
  },
  cleanupMenuButton: {
    minWidth: touchTarget.icon,
    minHeight: touchTarget.cta,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
  },
  moreButton: {
    minWidth: touchTarget.icon,
    minHeight: touchTarget.cta,
    paddingHorizontal: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxs,
  },
  lotWell: {
    padding: spacing.xs,
    gap: spacing.xs,
    backgroundColor: colors.insetSurface,
  },
  lotCard: {
    minHeight: touchTarget.min,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  lotCardStacked: {
    alignItems: "flex-start",
  },
  lotCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  lotCardPressed: {
    backgroundColor: colors.surfacePressed,
  },
  lotMain: {
    flex: 1,
    minWidth: 0,
    minHeight: touchTarget.min,
    paddingLeft: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  lotCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  selectionHit: {
    minWidth: touchTarget.icon,
    minHeight: touchTarget.min,
    alignItems: "center",
    justifyContent: "center",
    paddingRight: spacing.xs,
  },
  lotDate: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  lotMeta: {
    flexShrink: 1,
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.caption.fontFamily,
    color: colors.subtext,
  },
  expiryLamp: {
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  expiryLampDefault: {
    width: touchTarget.min,
    height: touchTarget.min,
  },
  expiryLampHero: {
    width: HERO_LAMP_SIZE,
    height: HERO_LAMP_SIZE,
  },
  expiryLampCompact: {
    minWidth: LOT_LAMP_SIZE,
    height: LOT_LAMP_SIZE,
    paddingHorizontal: spacing.xxs, // 4px so D-12 still fits the 32px lamp
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
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
});
