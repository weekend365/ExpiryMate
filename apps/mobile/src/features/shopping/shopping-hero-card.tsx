import type { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import {
  JangoHeroNoticeCarousel,
  type JangoHeroNoticeItem,
} from "../../components/JangoHeroNoticeCarousel";
import { colors, radius, spacing } from "../../shared/theme";
import type { MascotSpeechBubbleAppearance } from "../../components/MascotSpeechBubble";

export function ShoppingHeroCard({
  notices,
  children,
  appearance = "default",
}: PropsWithChildren<{
  notices: JangoHeroNoticeItem[];
  appearance?: MascotSpeechBubbleAppearance;
}>) {
  return (
    <View style={styles.card}>
      <JangoHeroNoticeCarousel notices={notices} appearance={appearance} />
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
