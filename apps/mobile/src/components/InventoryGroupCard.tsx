import {
  calculateDaysLeftUntilExpiry,
  formatDateKoreanCompact,
  getExpiryBucket,
  storageLocationLabels,
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
  MoreVertical,
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
  onItemMenuPress?: (item: InventoryItem) => void;
  onItemDiscard?: (item: InventoryItem) => void;
  isDiscarding?: boolean;
  selectionMode?: boolean;
  selectedIds?: ReadonlySet<string>;
}

export function InventoryGroupCard({
  group,
  expanded,
  onExpandedChange,
  onItemPress,
  onItemLongPress,
  onItemMenuPress,
  onItemDiscard,
  isDiscarding = false,
  selectionMode = false,
  selectedIds,
}: InventoryGroupCardProps) {
  const isExpandable = group.items.length > 1;
  const showLots = selectionMode || expanded;
  const nearestExpiry = getExpiryPresentation(group.nearestExpiryDate);
  const expiryDateCount = new Set(
    group.items.map((item) => item.expiryDate),
  ).size;
  const quantityLabel = group.hasMixedUnits
    ? `${group.items.length}개 보관 기록`
    : `총 ${group.totalQuantity}${group.unit ?? "개"}`;

  const handleSummaryPress = () => {
    if (selectionMode) {
      return;
    }

    if (!isExpandable) {
      onItemPress(group.items[0]!);
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
        accessibilityLabel={`${group.displayName}, ${quantityLabel}`}
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
          <Text style={styles.groupMeta}>
            {quantityLabel} · 유통기한 {expiryDateCount}개
          </Text>
        </View>

        <View style={styles.summaryAside}>
          <ExpiryBadge expiryDate={group.nearestExpiryDate} />
          {isExpandable ? (
            <View style={styles.expandAffordance}>
              <Text style={styles.expandLabel}>
                {showLots ? "접기" : "날짜별 보기"}
              </Text>
              {showLots ? (
                <ChevronUp
                  color={colors.primary}
                  size={spacing.sm}
                  strokeWidth={2.4}
                />
              ) : (
                <ChevronDown
                  color={colors.primary}
                  size={spacing.sm}
                  strokeWidth={2.4}
                />
              )}
            </View>
          ) : (
            <Text style={[styles.expiryState, { color: nearestExpiry.color }]}>
              {nearestExpiry.stateLabel}
            </Text>
          )}
        </View>
      </Pressable>

      {showLots ? (
        <View style={styles.lotList}>
          <View style={styles.divider} />
          <Text style={styles.lotSectionLabel}>유통기한별 보관 목록</Text>
          {group.items.map((item) => {
            const selected = selectedIds?.has(item.id) ?? false;
            const row = (
              <Pressable
                onPress={() => onItemPress(item)}
                onLongPress={() => onItemLongPress?.(item)}
                accessibilityRole="button"
                accessibilityLabel={`${formatDateKoreanCompact(item.expiryDate)}, ${item.quantity}${item.unit ?? "개"}`}
                accessibilityHint={
                  selectionMode
                    ? selected
                      ? "선택됨. 다시 누르면 선택을 해제해요."
                      : "누르면 정리할 재료로 골라요."
                    : "이 유통기한의 재료를 자세히 살펴봐요."
                }
                accessibilityState={
                  selectionMode ? { selected } : undefined
                }
                style={({ pressed }) => [
                  styles.lotRow,
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
                  <View style={styles.lotDateRow}>
                    <CalendarDays
                      color={colors.mutedText}
                      size={spacing.sm}
                      strokeWidth={2.3}
                    />
                    <Text style={styles.lotDate}>
                      {formatDateKoreanCompact(item.expiryDate)}
                    </Text>
                  </View>
                  <View style={styles.lotMetaRow}>
                    <MapPin
                      color={colors.mutedText}
                      size={spacing.sm}
                      strokeWidth={2.3}
                    />
                    <Text style={styles.lotMeta} numberOfLines={1}>
                      {storageLocationLabels[item.storageLocation]} · {item.quantity}
                      {item.unit ?? "개"}
                    </Text>
                  </View>
                </View>

                <ExpiryBadge expiryDate={item.expiryDate} compact />

                {!selectionMode && onItemMenuPress ? (
                  <Pressable
                    onPress={() => onItemMenuPress(item)}
                    hitSlop={spacing.xs}
                    accessibilityRole="button"
                    accessibilityLabel={`${formatDateKoreanCompact(item.expiryDate)} 재료 더보기`}
                    style={({ pressed }) => [
                      styles.menuButton,
                      pressed && styles.menuButtonPressed,
                    ]}
                  >
                    <MoreVertical
                      color={colors.subtext}
                      size={spacing.sm + spacing.xxs}
                      strokeWidth={2.4}
                    />
                  </Pressable>
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
      stateLabel: "만료됨",
    },
    today: {
      backgroundColor: colors.dangerSoft,
      color: colors.danger,
      icon: Clock3,
      stateLabel: "오늘 만료",
    },
    within_3_days: {
      backgroundColor: colors.warningSoft,
      color: colors.warning,
      icon: Clock3,
      stateLabel: "임박",
    },
    within_7_days: {
      backgroundColor: colors.primarySoft,
      color: colors.primary,
      icon: CalendarDays,
      stateLabel: "곧 만료",
    },
    safe: {
      backgroundColor: colors.successSoft,
      color: colors.success,
      icon: ShieldCheck,
      stateLabel: "안전",
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
  groupMeta: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.subtext,
  },
  summaryAside: {
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  expandAffordance: {
    minHeight: touchTarget.icon,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: spacing.xxs,
  },
  expandLabel: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.primary,
  },
  expiryState: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.label.fontFamily,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  lotList: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  lotSectionLabel: {
    paddingTop: spacing.xs,
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.mutedText,
  },
  lotRow: {
    minHeight: touchTarget.cta,
    borderRadius: radius.lg,
    backgroundColor: colors.mutedSurface,
    paddingLeft: spacing.sm,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
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
  lotDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
  },
  lotDate: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  lotMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
  },
  lotMeta: {
    flex: 1,
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
  menuButton: {
    width: touchTarget.icon,
    height: touchTarget.icon,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  menuButtonPressed: {
    backgroundColor: colors.surfacePressed,
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
    marginLeft: spacing.xs,
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
