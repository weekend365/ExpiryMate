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

interface InventoryGroupCardProps {
  group: InventoryItemGroup;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onItemPress: (item: InventoryItem) => void;
  onItemLongPress?: (item: InventoryItem) => void;
  /** Opens the cleanup sheet (consume / discard) for one lot. */
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

  return (
    <View style={styles.card}>
      <View style={styles.summaryRow}>
        <Pressable
          onPress={handleSummaryPress}
          onLongPress={
            selectionMode
              ? undefined
              : () => onItemLongPress?.(nearestItem)
          }
          disabled={selectionMode}
          accessibilityRole={selectionMode ? undefined : "button"}
          accessibilityLabel={`${group.displayName}, ${nearestPresentation.ddayLabel}${isExpandable ? `, ${lotCount}건` : ""}, ${locationLabel}, ${quantityLabel}`}
          accessibilityHint={
            selectionMode
              ? undefined
              : isExpandable
                ? "누르면 가장 임박한 기록으로 바로 가요. 더 보기로 다른 유통기한도 볼 수 있어요."
                : "누르면 자세히 살펴볼 수 있어요. 더보기로 정리할 수도 있어요."
          }
          style={({ pressed }) => [
            styles.summaryMain,
            shouldStack && styles.summaryMainStacked,
            pressed && styles.summaryPressed,
          ]}
        >
          {!showLots ? (
            <View style={styles.heroColumn}>
              <ExpiryBadge
                expiryDate={group.nearestExpiryDate}
                size="hero"
              />
              {isExpandable ? (
                <View style={styles.lotCountChip}>
                  <Text style={styles.lotCountChipLabel}>{lotCount}건</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.summaryCopy}>
            <Text style={styles.name}>
              {group.displayName}
              {group.brand ? (
                <Text style={styles.brandInline}> · {group.brand}</Text>
              ) : null}
            </Text>
            <Text style={styles.groupMeta}>
              {locationLabel} · {quantityLabel}
            </Text>
            {!showLots && isExpandable ? (
              <Text style={styles.imminentHint}>가장 임박한 기록으로 가요</Text>
            ) : null}
          </View>
        </Pressable>

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
              accessibilityLabel={showLots ? "접을게요" : "더 보기"}
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
              {showLots ? (
                <ChevronUp
                  color={colors.primary}
                  size={spacing.sm + spacing.xxs}
                  strokeWidth={2.4}
                />
              ) : (
                <ChevronDown
                  color={colors.primary}
                  size={spacing.sm + spacing.xxs}
                  strokeWidth={2.4}
                />
              )}
              <Text style={styles.moreButtonLabel}>
                {showLots ? "접기" : "더 보기"}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {showLots ? (
        <View style={styles.lotList}>
          <View style={styles.divider} />
          {group.items.map((item, index) => {
            const selected = selectedIds?.has(item.id) ?? false;
            const isNearest = index === 0;
            const lotExpiry = getExpiryLampPresentation(item.expiryDate);

            return (
              <View
                key={item.id}
                style={[
                  styles.lotRow,
                  shouldStack && styles.lotRowAccessible,
                  index > 0 && styles.lotRowBorder,
                  selected && styles.lotRowSelected,
                ]}
              >
                <Pressable
                  onPress={() => onItemPress(item)}
                  onLongPress={() => onItemLongPress?.(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`${formatDateKoreanCompact(item.expiryDate)}, ${lotExpiry.ddayLabel}, ${resolveLocationLabel(item.storageLocation)}, ${formatInventoryQuantity(item)}${isNearest && isExpandable ? ", 가장 임박" : ""}`}
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
                    pressed && styles.lotRowPressed,
                  ]}
                >
                  <View style={styles.lotCopy}>
                    <View style={styles.lotDateRow}>
                      <Text style={styles.lotDate}>
                        {formatDateKoreanCompact(item.expiryDate)}
                      </Text>
                      <Text
                        style={[
                          styles.lotDdayLabel,
                          { color: lotExpiry.lampColor },
                        ]}
                      >
                        {lotExpiry.ddayLabel}
                      </Text>
                      {isNearest && isExpandable ? (
                        <View style={styles.nearestPill}>
                          <Text style={styles.nearestPillLabel}>가장 임박</Text>
                        </View>
                      ) : null}
                    </View>
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
      accessibilityHint="다 먹었는지, 보관함에서 빼둘지 고를 수 있어요."
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
  size?: "default" | "hero";
}) {
  const presentation = getExpiryLampPresentation(expiryDate);
  const isHero = size === "hero";

  return (
    <View
      style={[
        styles.expiryLamp,
        isHero && styles.expiryLampHero,
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
  heroColumn: {
    alignItems: "center",
    gap: spacing.xxs,
  },
  lotCountChip: {
    minHeight: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.mutedSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  lotCountChipLabel: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.subtext,
    fontVariant: ["tabular-nums"],
  },
  summaryCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  name: {
    flexShrink: 1,
    fontSize: typography.subheading.fontSize,
    lineHeight: typography.subheading.lineHeight,
    fontFamily: typography.subheading.fontFamily,
    color: colors.text,
  },
  brandInline: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.mutedText,
  },
  groupMeta: {
    flexShrink: 1,
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.subtext,
  },
  imminentHint: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.primary,
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
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxs,
  },
  moreButtonLabel: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  lotList: {
    paddingBottom: spacing.none,
  },
  lotRow: {
    minHeight: touchTarget.cta + spacing.xxs,
    paddingRight: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  lotRowAccessible: {
    alignItems: "flex-start",
    paddingVertical: spacing.xs,
  },
  lotRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  lotRowSelected: {
    backgroundColor: colors.primarySoft,
  },
  lotRowPressed: {
    backgroundColor: colors.surfacePressed,
  },
  lotMain: {
    flex: 1,
    minWidth: 0,
    minHeight: touchTarget.cta + spacing.xxs,
    paddingLeft: spacing.sm,
    paddingVertical: spacing.xxs,
    justifyContent: "center",
  },
  lotCopy: {
    flexShrink: 1,
    gap: spacing.xxs,
  },
  selectionHit: {
    minWidth: touchTarget.icon,
    minHeight: touchTarget.cta,
    alignItems: "center",
    justifyContent: "center",
    paddingRight: spacing.xs,
  },
  lotDateRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  lotDate: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  lotDdayLabel: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.title.fontFamily,
    fontVariant: ["tabular-nums"],
  },
  nearestPill: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.warningSoft,
  },
  nearestPillLabel: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.warning,
  },
  lotMeta: {
    flexShrink: 1,
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.subtext,
  },
  expiryLamp: {
    width: touchTarget.min,
    height: touchTarget.min,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  expiryLampHero: {
    width: HERO_LAMP_SIZE,
    height: HERO_LAMP_SIZE,
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
