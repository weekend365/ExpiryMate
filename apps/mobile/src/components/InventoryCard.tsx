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
import { colors, radius, spacing, controlSize } from "../shared/theme";
import { useResponsiveLayout } from "../shared/responsive-layout";
import { AppText } from "./AppText";

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
        <View style={styles.copy}>
          <AppText
            variant="bodyStrong"
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
          <ExpiryBadge
            ddayLabel={presentation.ddayLabel}
            lampColor={presentation.lampColor}
          />
          <AppText
            variant="caption"
            tone="subtext"
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
          accessibilityLabel={`${item.displayName} 사용 기록`}
          accessibilityHint="전부 사용했는지 일부만 사용했는지 고를 수 있어요."
          style={({ pressed }) => [
            styles.trailingHit,
            styles.usageAction,
            shouldStack && styles.trailingHitStacked,
            pressed && styles.pressed,
          ]}
        >
          <CircleMinus
            color={colors.primaryForeground}
            size={spacing.sm + spacing.xxs}
            strokeWidth={2.4}
          />
          <AppText variant="bodySmall" tone="primary">사용 기록</AppText>
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
        style={styles.expiryLampText}
      >
        {ddayLabel}
      </AppText>
    </View>
  );
}

function getExpiryLampPresentation(expiryDate: string | null) {
  if (!expiryDate) {
    return { lampColor: colors.expiryUnknownAccent, ddayLabel: "기한 미입력" };
  }

  const bucket = getExpiryTrafficBucket(expiryDate);
  const daysLeft = calculateDaysLeftUntilExpiry(expiryDate);
  const ddayLabel =
    daysLeft < 0
      ? `${Math.abs(daysLeft)}일 지남`
      : daysLeft === 0
        ? "오늘까지"
        : `${daysLeft}일 남음`;

  const lampColor = {
    unknown: colors.expiryUnknownAccent,
    expired: colors.expiryExpiredAccent,
    within_7_days: colors.expiryExpiringAccent,
    safe: colors.expirySafeAccent,
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
    borderColor: colors.borderSubtle,
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
    borderBottomColor: colors.borderSubtle,
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
    alignSelf: "stretch",
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
  usageAction: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
  },
  expiryLamp: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  expiryLampText: {
    color: colors.expiryAccentForeground,
  },
  selectionIndicator: {
    width: spacing.lg,
    height: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.borderControl,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  selectionIndicatorSelected: {
    borderWidth: 0,
    backgroundColor: "transparent",
  },
});
