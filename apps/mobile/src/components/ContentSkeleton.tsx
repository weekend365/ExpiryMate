import { StyleSheet, View } from "react-native";
import { colors, radius, spacing } from "../shared/theme";

interface SkeletonBlockProps {
  height?: number;
  width?: number | `${number}%`;
  radiusToken?: keyof typeof radius;
  /** Use on dark surfaces (e.g. traffic strip) so placeholders stay visible. */
  onDark?: boolean;
}

/** Soft placeholder block for loading layouts (keeps screen structure). */
export function SkeletonBlock({
  height = spacing.lg,
  width = "100%",
  radiusToken = "lg",
  onDark = false,
}: SkeletonBlockProps) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.block,
        onDark && styles.blockOnDark,
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

const TRAFFIC_LAMP_SIZE = spacing.xxl + spacing.sm;

export function HomeStatsSkeleton() {
  return (
    <View
      style={styles.trafficGroup}
      accessibilityLabel="통계를 불러오고 있어요"
    >
      <View style={styles.trafficStrip}>
        {[0, 1, 2].map((index) => (
          <View key={index} style={styles.trafficLampSlot}>
            <SkeletonBlock
              height={TRAFFIC_LAMP_SIZE}
              width={TRAFFIC_LAMP_SIZE}
              radiusToken="pill"
              onDark
            />
          </View>
        ))}
      </View>
      <View style={styles.trafficLabels}>
        {[0, 1, 2].map((index) => (
          <View key={index} style={styles.trafficLabelSlot}>
            <SkeletonBlock height={spacing.sm} width="72%" />
          </View>
        ))}
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
  blockOnDark: {
    backgroundColor: colors.accent,
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
  trafficGroup: {
    gap: spacing.xs,
  },
  trafficStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.text,
  },
  trafficLampSlot: {
    flex: 1,
    alignItems: "center",
  },
  trafficLabels: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  trafficLabelSlot: {
    flex: 1,
    alignItems: "center",
  },
});
