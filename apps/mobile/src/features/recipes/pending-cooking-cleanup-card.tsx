import { router } from "expo-router";
import { CookingPot, Refrigerator } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { AppText } from "../../components/AppText";
import { Button } from "../../components/Button";
import { useResponsiveLayout } from "../../shared/responsive-layout";
import { colors, radius, spacing, touchTarget } from "../../shared/theme";
import { useAppStore } from "../../store/app-store";

export function PendingCookingCleanupCard() {
  const { shouldStack } = useResponsiveLayout();
  const cleanup = useAppStore((state) => state.pendingCookingCleanup);
  if (!cleanup) {
    return null;
  }

  return (
    <View testID="pending-cooking-cleanup-card" style={styles.card}>
      <View style={[styles.header, shouldStack && styles.headerStacked]}>
        <View style={styles.iconCircle}>
          <CookingPot color={colors.primary} size={spacing.md} strokeWidth={2.4} />
        </View>
        <View style={styles.copy}>
          <AppText variant="bodyStrong">{cleanup.dishTitle} 재고 정리가 남았어요</AppText>
          <AppText variant="bodySmall" tone="subtext">
            실제로 사용한 양만 확인하면 냉장고에 바로 반영할 수 있어요.
          </AppText>
        </View>
      </View>
      <Button
        icon={Refrigerator}
        variant="surface"
        size="small"
        onPress={() =>
          router.push({
            pathname: "/cooking/[recommendationId]",
            params: {
              recommendationId: cleanup.recommendationId,
              dishIndex: String(cleanup.dishIndex),
              cleanup: "1",
            },
          })
        }
        fullWidth
      >
        사용한 재료 정리하기
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  header: {
    minHeight: touchTarget.min,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  headerStacked: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  iconCircle: {
    width: touchTarget.icon,
    height: touchTarget.icon,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
});
