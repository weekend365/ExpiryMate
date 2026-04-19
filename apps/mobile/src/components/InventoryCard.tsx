import {
  formatDateKoreanCompact,
  getExpiryBucket,
  itemStatusLabels,
  storageLocationLabels,
  type InventoryItem,
} from "@expirymate/shared";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../shared/theme";

interface InventoryCardProps {
  item: InventoryItem;
  onPress?: () => void;
}

const expiryLabelMap = {
  expired: "이미 만료",
  today: "오늘 만료",
  within_3_days: "3일 이내 만료",
  within_7_days: "7일 이내 만료",
  safe: "여유 있음",
};

export function InventoryCard({ item, onPress }: InventoryCardProps) {
  const bucket = getExpiryBucket(item.expiryDate);
  const bucketStyle = bucketStyles[bucket];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.row}>
        <View style={styles.grow}>
          <Text style={styles.name}>{item.displayName}</Text>
          <Text style={styles.meta}>
            {storageLocationLabels[item.storageLocation]} · {item.quantity}
            {item.unit ?? "개"} · {itemStatusLabels[item.status]}
          </Text>
        </View>
        <View
          style={[
            styles.badge,
            {
              backgroundColor: bucketStyle.backgroundColor,
            },
          ]}
        >
          <Text style={[styles.badgeText, { color: bucketStyle.color }]}>
            {expiryLabelMap[bucket]}
          </Text>
        </View>
      </View>
      <Text style={styles.dateLabel}>유통기한 {formatDateKoreanCompact(item.expiryDate)}</Text>
    </Pressable>
  );
}

const bucketStyles = {
  expired: { backgroundColor: colors.dangerSoft, color: colors.danger },
  today: { backgroundColor: colors.dangerSoft, color: colors.danger },
  within_3_days: { backgroundColor: colors.warningSoft, color: colors.warning },
  within_7_days: { backgroundColor: colors.accentSoft, color: colors.accent },
  safe: { backgroundColor: colors.primarySoft, color: colors.primary },
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: spacing.md,
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  grow: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },
  meta: {
    fontSize: 13,
    color: colors.subtext,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  dateLabel: {
    fontSize: 14,
    color: colors.text,
  },
});
