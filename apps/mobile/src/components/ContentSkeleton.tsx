import { StyleSheet, View } from "react-native";
import { colors, radius, spacing } from "../shared/theme";

interface SkeletonBlockProps {
  height?: number;
  width?: number | `${number}%`;
  radiusToken?: keyof typeof radius;
}

/** Soft placeholder block for loading layouts (keeps screen structure). */
export function SkeletonBlock({
  height = spacing.lg,
  width = "100%",
  radiusToken = "lg",
}: SkeletonBlockProps) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.block,
        {
          height,
          width,
          borderRadius: radius[radiusToken],
        },
      ]}
    />
  );
}

export function InventoryListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View style={styles.list} accessibilityLabel="보관함을 불러오고 있어요">
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={styles.card}>
          <View style={styles.cardCopy}>
            <SkeletonBlock height={spacing.md} width="62%" />
            <SkeletonBlock height={spacing.sm} width="48%" />
            <SkeletonBlock height={spacing.sm} width="40%" />
          </View>
          <SkeletonBlock height={spacing.xl} width={spacing.xxxl} radiusToken="pill" />
        </View>
      ))}
    </View>
  );
}

export function HomeStatsSkeleton() {
  return (
    <View style={styles.statsRow} accessibilityLabel="통계를 불러오고 있어요">
      <View style={styles.statInline}>
        <SkeletonBlock height={spacing.lg} width={spacing.xl} />
        <SkeletonBlock height={spacing.sm} width="70%" />
      </View>
      <View style={styles.statInline}>
        <SkeletonBlock height={spacing.lg} width={spacing.xl} />
        <SkeletonBlock height={spacing.sm} width="70%" />
      </View>
      <View style={styles.statInline}>
        <SkeletonBlock height={spacing.lg} width={spacing.xl} />
        <SkeletonBlock height={spacing.sm} width="70%" />
      </View>
    </View>
  );
}

export function HomeListSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <View style={styles.list} accessibilityLabel="목록을 불러오고 있어요">
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={styles.card}>
          <View style={styles.cardCopy}>
            <SkeletonBlock height={spacing.md} width="58%" />
            <SkeletonBlock height={spacing.sm} width="44%" />
          </View>
          <SkeletonBlock height={spacing.xl} width={spacing.xxxl} radiusToken="pill" />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: colors.mutedSurface,
  },
  list: {
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: spacing.xxxl + spacing.xl,
  },
  cardCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  statInline: {
    flex: 1,
    gap: spacing.xxs,
    paddingVertical: spacing.xs,
  },
});
