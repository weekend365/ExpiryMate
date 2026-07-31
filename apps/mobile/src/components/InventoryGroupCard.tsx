import {
  calculateDaysLeftUntilExpiry,
  formatDateKoreanCompact,
  formatInventoryQuantity,
  getExpiryTrafficBucket,
  resolveStorageLocationLabel,
  type InventoryItem,
  type InventoryItemGroup,
} from "@expirymate/shared";
import * as Haptics from "expo-haptics";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Trash2,
} from "lucide-react-native";
import { createRef, useEffect, useRef, type RefObject } from "react";
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from "react-native";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import { colors, radius, spacing, touchTarget, typography } from "../shared/theme";
import { useResponsiveLayout } from "../shared/responsive-layout";

interface InventoryGroupCardProps {
  group: InventoryItemGroup;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onItemPress: (item: InventoryItem) => void;
  onItemLongPress?: (item: InventoryItem) => void;
  onItemDiscard?: (item: InventoryItem) => void;
  isDiscarding?: boolean;
  onSwipeableOpen?: (closeSwipeable: () => void) => void;
  showSwipeHint?: boolean;
  onSwipeHintSeen?: () => void;
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
  onSwipeableOpen,
  showSwipeHint = false,
  onSwipeHintSeen,
  selectionMode = false,
  selectedIds,
  resolveLocationLabel = resolveStorageLocationLabel,
}: InventoryGroupCardProps) {
  const { shouldStack } = useResponsiveLayout();
  const isExpandable = group.items.length > 1;
  const showLots = selectionMode || expanded;
  const nearestItem = group.items[0]!;


  const quantityLabel = group.hasMixedUnits
    ? `보관 기록 ${group.items.length}건`
    : `총 ${group.totalQuantity}${group.unit ?? "개"}`;
  const locationLabel = getGroupLocationLabel(group.items, resolveLocationLabel);
  const singleSwipeableRef = useRef<SwipeableMethods | null>(null);
  const lotSwipeableRefs = useRef(
    new Map<string, RefObject<SwipeableMethods | null>>(),
  );
  const isHintAnimationRef = useRef(false);

  const getLotSwipeableRef = (itemId: string) => {
    const existing = lotSwipeableRefs.current.get(itemId);

    if (existing) {
      return existing;
    }

    const created = createRef<SwipeableMethods>();
    lotSwipeableRefs.current.set(itemId, created);
    return created;
  };

  const handleSwipeableWillOpen = (swipeable: SwipeableMethods) => {
    onSwipeableOpen?.(() => swipeable.close());

    if (!isHintAnimationRef.current) {
      void Haptics.selectionAsync().catch(() => undefined);
      onSwipeHintSeen?.();
    }
  };

  useEffect(() => {
    if (!showSwipeHint || selectionMode) {
      return;
    }

    const target = isExpandable
      ? showLots
        ? lotSwipeableRefs.current.get(nearestItem.id)?.current
        : null
      : singleSwipeableRef.current;

    if (!target) {
      return;
    }

    let closeTimer: ReturnType<typeof setTimeout> | undefined;
    let seenTimer: ReturnType<typeof setTimeout> | undefined;
    const openTimer = setTimeout(() => {
      isHintAnimationRef.current = true;
      target.openRight();
      closeTimer = setTimeout(() => {
        target.close();
        isHintAnimationRef.current = false;
        seenTimer = setTimeout(() => onSwipeHintSeen?.(), 220);
      }, 850);
    }, 650);

    return () => {
      clearTimeout(openTimer);
      if (closeTimer) {
        clearTimeout(closeTimer);
      }
      if (seenTimer) {
        clearTimeout(seenTimer);
      }
      isHintAnimationRef.current = false;
    };
  }, [
    isExpandable,
    nearestItem.id,
    onSwipeHintSeen,
    selectionMode,
    showLots,
    showSwipeHint,
  ]);

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

  const card = (
    <View style={styles.card}>
      <View style={styles.summaryRow}>
        <Pressable
          onPress={handleSummaryPress}
          disabled={selectionMode}
          accessibilityRole={selectionMode ? undefined : "button"}
          accessibilityLabel={`${group.displayName}, ${locationLabel}, ${quantityLabel}`}
          accessibilityHint={
            isExpandable
              ? showLots
                ? "유통기한별 목록을 접어요."
                : "유통기한별 목록을 펼쳐 편집하거나 삭제할 기록을 골라요."
              : "누르면 바로 편집하고, 왼쪽으로 밀면 삭제할 수 있어요."
          }
          accessibilityState={isExpandable ? { expanded: showLots } : undefined}
          accessibilityActions={
            !selectionMode && !isExpandable && onItemDiscard
              ? [{ name: "delete", label: "삭제" }]
              : undefined
          }
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === "delete") {
              onItemDiscard?.(nearestItem);
            }
          }}
          style={({ pressed }) => [
            styles.summaryMain,
            shouldStack && styles.summaryMainStacked,
            pressed && styles.summaryPressed,
          ]}
        >
          {!showLots ? (
            <ExpiryBadge expiryDate={group.nearestExpiryDate} />
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
          </View>

          <View style={styles.summaryAside}>
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
      </View>

      {showLots ? (
        <View style={styles.lotList}>
          <View style={styles.divider} />
          {group.items.map((item, index) => {
            const selected = selectedIds?.has(item.id) ?? false;
            const swipeableRef = getLotSwipeableRef(item.id);
            const row = (
              <Pressable
                onPress={() => onItemPress(item)}
                onLongPress={() => onItemLongPress?.(item)}
                accessibilityRole="button"
                accessibilityLabel={`${formatDateKoreanCompact(item.expiryDate)}, ${resolveLocationLabel(item.storageLocation)}, ${formatInventoryQuantity(item)}`}
                accessibilityHint={
                  selectionMode
                    ? selected
                      ? "선택됨. 다시 누르면 선택을 해제해요."
                      : "누르면 정리할 재료로 골라요."
                    : "누르면 바로 편집하고, 왼쪽으로 밀면 삭제할 수 있어요."
                }
                accessibilityState={
                  selectionMode ? { selected } : undefined
                }
                accessibilityActions={
                  !selectionMode && onItemDiscard
                    ? [{ name: "delete", label: "삭제" }]
                    : undefined
                }
                onAccessibilityAction={(event) => {
                  if (event.nativeEvent.actionName === "delete") {
                    onItemDiscard?.(item);
                  }
                }}
                style={({ pressed }) => [
                  styles.lotRow,
                  shouldStack && styles.lotRowAccessible,
                  index > 0 && styles.lotRowBorder,
                  selected && styles.lotRowSelected,
                  pressed && styles.lotRowPressed,
                ]}
              >
                <ExpiryBadge expiryDate={item.expiryDate} />

                <View style={styles.lotCopy}>
                  <Text style={styles.lotDate}>
                    {formatDateKoreanCompact(item.expiryDate)}
                  </Text>
                  <Text style={styles.lotMeta}>
                    {resolveLocationLabel(item.storageLocation)} ·{" "}
                    {formatInventoryQuantity(item)}
                  </Text>
                </View>

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
              </Pressable>
            );

            if (selectionMode || !onItemDiscard) {
              return <View key={item.id}>{row}</View>;
            }

            return (
              <ReanimatedSwipeable
                key={item.id}
                ref={swipeableRef}
                friction={1.2}
                rightThreshold={spacing.md}
                dragOffsetFromRightEdge={spacing.xs}
                overshootRight={false}
                onSwipeableWillOpen={() => {
                  const swipeable = swipeableRef.current;

                  if (swipeable) {
                    handleSwipeableWillOpen(swipeable);
                  }
                }}
                renderRightActions={(_, __, swipeable) => (
                  <ListSwipeDeleteAction
                    disabled={isDiscarding}
                    accessibilityLabel={`${formatDateKoreanCompact(item.expiryDate)} 재료 삭제`}
                    onPress={() => {
                      swipeable.close();
                      onItemDiscard(item);
                    }}
                  />
                )}
              >
                {row}
              </ReanimatedSwipeable>
            );
          })}

        </View>
      ) : null}
    </View>
  );

  if (isExpandable || selectionMode || !onItemDiscard) {
    return card;
  }

  return (
    <ReanimatedSwipeable
      ref={singleSwipeableRef}
      friction={1.2}
      rightThreshold={spacing.md}
      dragOffsetFromRightEdge={spacing.xs}
      overshootRight={false}
      onSwipeableWillOpen={() => {
        if (singleSwipeableRef.current) {
          handleSwipeableWillOpen(singleSwipeableRef.current);
        }
      }}
      renderRightActions={(_, __, swipeable) => (
        <SingleSwipeDeleteAction
          disabled={isDiscarding}
          accessibilityLabel={`${group.displayName} 삭제`}
          onPress={() => {
            swipeable.close();
            onItemDiscard(nearestItem);
          }}
        />
      )}
    >
      {card}
    </ReanimatedSwipeable>
  );
}

function ListSwipeDeleteAction({
  accessibilityLabel,
  disabled,
  onPress,
}: {
  accessibilityLabel: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.listSwipeAction,
        pressed && styles.swipeActionPressed,
        disabled && styles.swipeActionDisabled,
      ]}
    >
      <DeleteActionContent />
    </Pressable>
  );
}

function SingleSwipeDeleteAction({
  accessibilityLabel,
  disabled,
  onPress,
}: {
  accessibilityLabel: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <View style={styles.singleSwipeActionSlot}>
      <Pressable
        disabled={disabled}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [
          styles.singleSwipeActionTrack,
          pressed && styles.swipeActionPressed,
          disabled && styles.swipeActionDisabled,
        ]}
      >
        <View style={styles.singleSwipeActionContent}>
          <DeleteActionContent />
        </View>
      </Pressable>
    </View>
  );
}

function DeleteActionContent() {
  return (
    <>
      <Trash2 color={colors.surface} size={spacing.md} strokeWidth={2.4} />
      <Text style={styles.swipeActionLabel}>삭제</Text>
    </>
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

function ExpiryBadge({ expiryDate }: { expiryDate: string }) {
  const presentation = getExpiryLampPresentation(expiryDate);

  return (
    <View
      style={[
        styles.expiryLamp,
        { backgroundColor: presentation.lampColor },
      ]}
      accessibilityLabel={presentation.ddayLabel}
    >
      <Text style={styles.expiryLampText}>{presentation.ddayLabel}</Text>
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
    minHeight: touchTarget.min,
    flexDirection: "row",
    alignItems: "center",
  },
  summaryMain: {
    flex: 1,
    minWidth: 0,
    minHeight: touchTarget.min,
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
  summaryAside: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
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
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
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
  lotCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
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
  expiryLampText: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
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
  listSwipeAction: {
    width: spacing.xxxl,
    minHeight: touchTarget.cta + spacing.xxs,
    height: "100%",
    alignSelf: "stretch",
    borderRadius: radius.none,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxs,
    paddingHorizontal: spacing.xs,
  },
  singleSwipeActionSlot: {
    width: spacing.xxxl,
    height: "100%",
    alignSelf: "stretch",
    overflow: "visible",
  },
  singleSwipeActionTrack: {
    position: "absolute",
    top: spacing.none,
    right: spacing.none,
    bottom: spacing.none,
    width: spacing.xxxl + spacing.md,
    borderTopRightRadius: radius.xxl,
    borderBottomRightRadius: radius.xxl,
    backgroundColor: colors.danger,
  },
  singleSwipeActionContent: {
    width: spacing.xxxl,
    height: "100%",
    alignSelf: "flex-end",
    alignItems: "center",
    justifyContent: "center",
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
