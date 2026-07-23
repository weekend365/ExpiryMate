import {
  calculateDaysLeftUntilExpiry,
  formatDateKoreanCompact,
  getExpiryBucket,
  itemStatusLabels,
  resolveStorageLocationLabel,
  type InventoryItem,
} from "@expirymate/shared";
import {
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  MapPin,
  MoreVertical,
  ShieldCheck,
} from "lucide-react-native";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { colors, radius, spacing, touchTarget, typography } from "../shared/theme";

interface InventoryCardProps {
  item: InventoryItem;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Opens an accessible action sheet (자세히 / 고르기 / 정리). */
  onMenuPress?: () => void;
  selected?: boolean;
  selectionMode?: boolean;
}

const expiryLabelMap = {
  expired: "만료됨",
  today: "오늘 만료",
  within_3_days: "임박",
  within_7_days: "곧 만료",
  safe: "안전",
};

export function InventoryCard({
  item,
  onPress,
  onLongPress,
  onMenuPress,
  selected,
  selectionMode,
}: InventoryCardProps) {
  const { width } = useWindowDimensions();
  const isCompact = width < 380;
  const bucket = getExpiryBucket(item.expiryDate);
  const bucketStyle = bucketStyles[bucket];
  const daysLeft = calculateDaysLeftUntilExpiry(item.expiryDate);
  const DDayIcon = bucketStyle.icon;
  const ddayLabel =
    daysLeft < 0
      ? `D+${Math.abs(daysLeft)}`
      : daysLeft === 0
        ? "오늘"
        : `D-${daysLeft}`;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={item.displayName}
      accessibilityHint={
        selectionMode
          ? selected
            ? "선택됨. 다시 누르면 선택을 해제해요."
            : "누르면 선택해요. 헤더의 고르기로도 시작할 수 있어요."
          : onPress
            ? "눌러서 자세히 살펴볼 수 있어요. 더보기로 정리할 수도 있어요."
            : undefined
      }
      accessibilityState={
        selectionMode ? { selected: Boolean(selected) } : undefined
      }
      style={({ pressed }) => [
        styles.card,
        isCompact && styles.cardCompact,
        selectionMode && styles.selectableCard,
        selected && styles.selectedCard,
        pressed && styles.cardPressed,
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
            <CheckCircle2 color={colors.surface} size={spacing.sm} strokeWidth={2.4} />
          ) : null}
        </View>
      ) : null}

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
            {item.displayName}
          </Text>
          {!selectionMode && onMenuPress ? (
            <Pressable
              onPress={onMenuPress}
              hitSlop={spacing.xs}
              accessibilityRole="button"
              accessibilityLabel={`${item.displayName} 더보기`}
              accessibilityHint="자세히 보기, 고르기, 정리하기를 고를 수 있어요."
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
        </View>
        <View style={styles.metaRow}>
          <MapPin color={colors.mutedText} size={spacing.sm} strokeWidth={2.3} />
          <Text style={styles.meta} numberOfLines={1}>
            {resolveStorageLocationLabel(item.storageLocation)} · {item.quantity}
            {item.unit ?? "개"} · {itemStatusLabels[item.status]}
          </Text>
        </View>
        <View style={styles.dateRow}>
          <CalendarDays color={colors.mutedText} size={spacing.sm} strokeWidth={2.3} />
          <Text style={styles.dateLabel}>
            유통기한 {formatDateKoreanCompact(item.expiryDate)}
          </Text>
        </View>
      </View>

      <View style={[styles.badgeColumn, isCompact && styles.badgeColumnCompact]}>
        <View
          style={[
            styles.badge,
            {
              backgroundColor: bucketStyle.backgroundColor,
            },
          ]}
        >
          <DDayIcon color={bucketStyle.color} size={spacing.sm} strokeWidth={2.5} />
          <Text style={[styles.badgeText, { color: bucketStyle.color }]}>
            {ddayLabel}
          </Text>
        </View>
        <Text style={[styles.bucketLabel, { color: bucketStyle.color }]}>
          {expiryLabelMap[bucket]}
        </Text>
      </View>
    </Pressable>
  );
}

const bucketStyles = {
  expired: { backgroundColor: colors.dangerSoft, color: colors.danger, icon: CircleAlert },
  today: { backgroundColor: colors.dangerSoft, color: colors.danger, icon: Clock3 },
  within_3_days: { backgroundColor: colors.warningSoft, color: colors.warning, icon: Clock3 },
  within_7_days: { backgroundColor: colors.primarySoft, color: colors.primary, icon: CalendarDays },
  safe: { backgroundColor: colors.successSoft, color: colors.success, icon: ShieldCheck },
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    minHeight: touchTarget.min,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  cardCompact: {
    alignItems: "flex-start",
  },
  cardPressed: {
    backgroundColor: colors.surfacePressed,
  },
  selectableCard: {
    paddingLeft: spacing.sm,
  },
  selectedCard: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
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
  content: {
    flex: 1,
    gap: spacing.xs,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  name: {
    flex: 1,
    fontSize: typography.subheading.fontSize,
    lineHeight: typography.subheading.lineHeight,
    fontFamily: typography.subheading.fontFamily,
    color: colors.text,
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
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
  },
  meta: {
    flex: 1,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.subtext,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
  },
  dateLabel: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.subtext,
  },
  badgeColumn: {
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  badgeColumnCompact: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  badge: {
    minWidth: spacing.xl + spacing.lg,
    minHeight: spacing.lg,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxs,
  },
  badgeText: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
  },
  bucketLabel: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.label.fontFamily,
  },
});
