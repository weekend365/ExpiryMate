import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { spacing } from "../shared/theme";
import { AppText } from "./AppText";

interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function SectionHeader({ title, description, action }: SectionHeaderProps) {
  return (
    <View style={styles.root}>
      <View style={styles.copy}>
        <AppText variant="subheading">{title}</AppText>
        {description ? (
          <AppText variant="bodySmall" tone="subtext">
            {description}
          </AppText>
        ) : null}
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
  },
  action: {
    paddingTop: spacing.xxs,
  },
});
