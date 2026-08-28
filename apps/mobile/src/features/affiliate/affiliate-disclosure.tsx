import { COUPANG_PARTNERS_DISCLOSURE } from "@expirymate/shared";
import { StyleSheet, View } from "react-native";
import { AppText } from "../../components/AppText";
import { spacing } from "../../shared/theme";

export function AffiliateDisclosure({
  disclosure = COUPANG_PARTNERS_DISCLOSURE,
  supportingText,
}: {
  disclosure?: string;
  supportingText?: string;
}) {
  return (
    <View
      accessible
      accessibilityRole="text"
      style={styles.container}
      accessibilityLabel={[disclosure, supportingText].filter(Boolean).join(" ")}
    >
      <AppText variant="caption" tone="disclosure">
        {disclosure}
      </AppText>
      {supportingText ? (
        <AppText variant="caption" tone="disclosure">
          {supportingText}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xxs,
  },
});
