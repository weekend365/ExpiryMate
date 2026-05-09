import {
  calculateDaysLeftUntilExpiry,
  formatDateKoreanCompact,
  getExpiryBucket,
  itemStatusLabels,
  storageLocationLabels,
  type InventoryItem,
} from "@expirymate/shared";
import {
  CalendarDays,
  ChevronRight,
  CircleAlert,
  Clock3,
  MapPin,
  ShieldCheck,
} from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../shared/theme";

interface InventoryCardProps {
  item: InventoryItem;
  onPress?: () => void;
}

const expiryLabelMap = {
  expired: "만료됨",
  today: "오늘 만료",
  within_3_days: "임박",
  within_7_days: "곧 만료",
  safe: "안전",
};

export function InventoryCard({ item, onPress }: InventoryCardProps) {
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
      disabled={!onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>{item.displayName}</Text>
          {onPress ? <ChevronRight color={colors.mutedText} size={18} /> : null}
        </View>
        <View style={styles.metaRow}>
          <MapPin color={colors.mutedText} size={14} strokeWidth={2.3} />
          <Text style={styles.meta} numberOfLines={1}>
            {storageLocationLabels[item.storageLocation]} · {item.quantity}
            {item.unit ?? "개"} · {itemStatusLabels[item.status]}
          </Text>
        </View>
        <View style={styles.dateRow}>
          <CalendarDays color={colors.mutedText} size={14} strokeWidth={2.3} />
          <Text style={styles.dateLabel}>
            유통기한 {formatDateKoreanCompact(item.expiryDate)}
          </Text>
        </View>
      </View>

      <View style={styles.badgeColumn}>
        <View
          style={[
            styles.badge,
            {
              backgroundColor: bucketStyle.backgroundColor,
            },
          ]}
        >
          <DDayIcon color={bucketStyle.color} size={15} strokeWidth={2.5} />
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  cardPressed: {
    backgroundColor: colors.surfacePressed,
  },
  content: {
    flex: 1,
    gap: 8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  name: {
    flex: 1,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    color: colors.text,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  meta: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: colors.subtext,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dateLabel: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.subtext,
  },
  badgeColumn: {
    alignItems: "flex-end",
    gap: 6,
  },
  badge: {
    minWidth: 72,
    minHeight: 34,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  badgeText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },
  bucketLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
});
