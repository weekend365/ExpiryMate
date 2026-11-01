import type { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import {
  JangoHeroNoticeCarousel,
  type JangoHeroNoticeItem,
} from "../../components/JangoHeroNoticeCarousel";
import { useResponsiveLayout } from "../../shared/responsive-layout";
import { colors, radius, spacing } from "../../shared/theme";

export function ShoppingHeroCard({
  notices,
  children,
}: PropsWithChildren<{
  notices: JangoHeroNoticeItem[];
}>) {
  const { shouldStackDense } = useResponsiveLayout();

  return (
    <View style={styles.card}>
      <JangoHeroNoticeCarousel
        notices={notices}
        size="small"
        layout={shouldStackDense ? "stacked" : "inline"}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    padding: spacing.sm,
    gap: spacing.sm,
  },
});
