import {
  calculateDaysLeftUntilExpiry,
  formatDateKoreanCompact,
  getExpiryBucket,
  resolveStorageLocationLabel,
  type InventoryItem,
  type InventoryItemGroup,
} from "@expirymate/shared";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Clock3,
  MapPin,
  ShieldCheck,
  Trash2,
} from "lucide-react-native";
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { colors, radius, spacing, touchTarget, typography } from "../shared/theme";

interface InventoryGroupCardProps {
  group: InventoryItemGroup;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onItemPress: (item: InventoryItem) => void;
  onItemLongPress?: (item: InventoryItem) => void;
  onItemDiscard?: (item: InventoryItem) => void;
  isDiscarding?: boolean;
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
  onItemDiscard,
  isDiscarding = false,
  selectionMode = false,
  selectedIds,
  resolveLocationLabel = resolveStorageLocationLabel,
}: InventoryGroupCardProps) {
  const isExpandable = group.items.length > 1;
  const showLots = selectionMode || expanded;
  const nearestItem = group.items[0]!;
  const expiryDateCount = new Set(
    group.items.map((item) => item.expiryDate),
  ).size;
  const quantityLabel = group.hasMixedUnits
    ? `보관 기록 ${group.items.length}건`
    : `총 ${group.totalQuantity}${group.unit ?? "개"}`;
  const locationLabel = getGroupLocationLabel(group.items, resolveLocationLabel);
  const nearestBucket = getExpiryBucket(group.nearestExpiryDate);
  const showUrgentDiscard =
    !selectionMode &&
    !showLots &&
    Boolean(onItemDiscard) &&
    (nearestBucket === "expired" ||
      nearestBucket === "today" ||
      nearestBucket === "within_3_days");

  const handleSummaryPress = () => {
    if (selectionMode) {
      return;
    }

    if (!isExpandable) {
      onItemPress(nearestItem);
      return;
    }

    LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
    onExpandedChange(!expanded);
  };

  return (
    <View style={styles.card}>
      <Pressable
        onPress={handleSummaryPress}
        disabled={selectionMode}
        accessibilityRole={selectionMode ? undefined : "button"}
        accessibilityLabel={`${group.displayName}, ${locationLabel}, ${quantityLabel}`}
        accessibilityHint={
          isExpandable
            ? showLots
              ? "유통기한별 목록을 접어요."
              : "유통기한별 목록을 펼쳐요."
            : "재료를 자세히 살펴봐요."
        }
        accessibilityState={isExpandable ? { expanded: showLots } : undefined}
        style={({ pressed }) => [
          styles.summary,
          pressed && styles.summaryPressed,
        ]}
      >
        <View style={styles.summaryCopy}>
          <Text style={styles.name} numberOfLines={1}>
            {group.displayName}
          </Text>
          {group.brand ? (
            <Text style={styles.brand} numberOfLines={1}>
              {group.brand}
            </Text>
          ) : null}
          <View style={styles.metaRow}>
            <View style={styles.locationChip}>
              <MapPin
                color={colors.subtext}
                size={spacing.sm}
                strokeWidth={2.3}
              />
              <Text style={styles.locationChipLabel}>{locationLabel}</Text>
            </View>
            <Text style={styles.groupMeta}>
              {quantityLabel} · 유통기한 {expiryDateCount}개
            </Text>
          </View>
        </View>

        <View style={styles.summaryAside}>
          <ExpiryBadge expiryDate={group.nearestExpiryDate} />
          {isExpandable ? (
            showLots ? (
              <ChevronUp
                color={colors.primary}
                size={spacing.sm + spacing.xxs}
                strokeWidth={2.4}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
            ) : (
              <ChevronDown
                color={colors.primary}
                size={spacing.sm + spacing.xxs}
                strokeWidth={2.4}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
            )
          ) : null}
        </View>
      </Pressable>

      {showUrgentDiscard ? (
        <View style={styles.urgentActionRow}>
          <Pressable
            disabled={isDiscarding}
            onPress={() => onItemDiscard?.(nearestItem)}
            accessibilityRole="button"
            accessibilityLabel={`${group.displayName} 정리할게요`}
            style={({ pressed }) => [
              styles.urgentActionButton,
              pressed && styles.urgentActionButtonPressed,
              isDiscarding && styles.urgentActionButtonDisabled,
            ]}
          >
            <Trash2
              color={colors.danger}
              size={spacing.sm + spacing.xxs}
              strokeWidth={2.4}
            />
            <Text style={styles.urgentActionLabel}>정리할게요</Text>
          </Pressable>
        </View>
      ) : null}

      {showLots ? (
        <View style={styles.lotList}>
          <View style={styles.divider} />
          {group.items.map((item, index) => {
            const selected = selectedIds?.has(item.id) ?? false;
            const bucket = getExpiryBucket(item.expiryDate);
            const showUrgentBadge = bucket !== "safe";
            const row = (
              <Pressable
                onPress={() => onItemPress(item)}
                onLongPress={() => onItemLongPress?.(item)}
                accessibilityRole="button"
                accessibilityLabel={`${formatDateKoreanCompact(item.expiryDate)}, ${resolveLocationLabel(item.storageLocation)}, ${item.quantity}${item.unit ?? "개"}`}
                accessibilityHint={
                  selectionMode
                    ? selected
                      ? "선택됨. 다시 누르면 선택을 해제해요."
                      : "누르면 정리할 재료로 골라요."
                    : "자세히 보려면 누르고, 고르려면 길게 누르고, 정리하려면 밀어 주세요."
                }
                accessibilityState={
                  selectionMode ? { selected } : undefined
                }
                style={({ pressed }) => [
                  styles.lotRow,
                  index > 0 && styles.lotRowBorder,
                  selected && styles.lotRowSelected,
                  pressed && styles.lotRowPressed,
                ]}
              >
                {selectionMode ? (
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
                ) : null}

                <View style={styles.lotCopy}>
                  <Text style={styles.lotDate}>
                    {formatDateKoreanCompact(item.expiryDate)}
                  </Text>
                  <Text style={styles.lotMeta} numberOfLines={1}>
                    {resolveLocationLabel(item.storageLocation)} · {item.quantity}
                    {item.unit ?? "개"}
                  </Text>
                </View>

                {showUrgentBadge ? (
                  <ExpiryBadge expiryDate={item.expiryDate} compact />
                ) : null}
              </Pressable>
            );

            if (!onItemDiscard || selectionMode) {
              return <View key={item.id}>{row}</View>;
            }

            return (
              <Swipeable
                key={item.id}
                friction={2}
                rightThreshold={touchTarget.icon}
                overshootRight={false}
                renderRightActions={(_, __, swipeable) => (
                  <Pressable
                    disabled={isDiscarding}
                    onPress={() => {
                      swipeable.close();
                      onItemDiscard(item);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${formatDateKoreanCompact(item.expiryDate)} 재료 정리하기`}
                    style={({ pressed }) => [
                      styles.swipeAction,
                      pressed && styles.swipeActionPressed,
                      isDiscarding && styles.swipeActionDisabled,
                    ]}
                  >
                    <Trash2
                      color={colors.surface}
                      size={spacing.md}
                      strokeWidth={2.4}
                    />
                    <Text style={styles.swipeActionLabel}>정리할게요</Text>
                  </Pressable>
                )}
              >
                {row}
              </Swipeable>
            );
          })}
        </View>
      ) : null}
    </View>
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
  compact = false,
}: {
  expiryDate: string;
  compact?: boolean;
}) {
  const presentation = getExpiryPresentation(expiryDate);
  const Icon = presentation.icon;

  return (
    <View
      style={[
        styles.badge,
        compact && styles.badgeCompact,
        { backgroundColor: presentation.backgroundColor },
      ]}
    >
      <Icon color={presentation.color} size={spacing.sm} strokeWidth={2.5} />
      <Text style={[styles.badgeText, { color: presentation.color }]}>
        {presentation.ddayLabel}
      </Text>
    </View>
  );
}

function getExpiryPresentation(expiryDate: string) {
  const bucket = getExpiryBucket(expiryDate);
  const daysLeft = calculateDaysLeftUntilExpiry(expiryDate);
  const ddayLabel =
    daysLeft < 0
      ? `D+${Math.abs(daysLeft)}`
      : daysLeft === 0
        ? "오늘"
        : `D-${daysLeft}`;

  const presentation = {
    expired: {
      backgroundColor: colors.dangerSoft,
      color: colors.danger,
      icon: CircleAlert,
    },
    today: {
      backgroundColor: colors.dangerSoft,
      color: colors.danger,
      icon: Clock3,
    },
    within_3_days: {
      backgroundColor: colors.warningSoft,
      color: colors.warning,
      icon: Clock3,
    },
    within_7_days: {
      backgroundColor: colors.primarySoft,
      color: colors.primary,
      icon: CalendarDays,
    },
    safe: {
      backgroundColor: colors.successSoft,
      color: colors.success,
      icon: ShieldCheck,
    },
  }[bucket];

  return { ...presentation, ddayLabel };
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  summary: {
    minHeight: touchTarget.min,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  summaryPressed: {
    backgroundColor: colors.surfacePressed,
  },
  summaryCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  name: {
    fontSize: typography.subheading.fontSize,
    lineHeight: typography.subheading.lineHeight,
    fontFamily: typography.subheading.fontFamily,
    color: colors.text,
  },
  brand: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.mutedText,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.xs,
  },
  locationChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.mutedSurface,
  },
  locationChipLabel: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.subtext,
  },
  groupMeta: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.subtext,
  },
  summaryAside: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
  },
  urgentActionRow: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  urgentActionButton: {
    minHeight: touchTarget.min,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.dangerSoft,
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: spacing.sm,
  },
  urgentActionButtonPressed: {
    backgroundColor: colors.surfacePressed,
  },
  urgentActionButtonDisabled: {
    opacity: 0.55,
  },
  urgentActionLabel: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.danger,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  lotList: {
    paddingBottom: spacing.xs,
  },
  lotRow: {
    minHeight: touchTarget.min,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
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
  lotCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  lotDate: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  lotMeta: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.subtext,
  },
  badge: {
    minHeight: spacing.lg,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxs,
  },
  badgeCompact: {
    minWidth: spacing.xl + spacing.md,
  },
  badgeText: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
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
  swipeAction: {
    width: spacing.xxxl + spacing.lg,
    minHeight: touchTarget.min,
    borderRadius: radius.lg,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: spacing.xs,
    marginRight: spacing.sm,
    gap: spacing.xxs,
    paddingHorizontal: spacing.xs,
  },
  swipeActionPressed: {
    backgroundColor: colors.dangerPressed,
  },
  swipeActionDisabled: {
    opacity: 0.55,
  },
  swipeActionLabel: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.surface,
    textAlign: "center",
  },
});
