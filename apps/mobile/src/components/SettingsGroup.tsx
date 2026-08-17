import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { colors, radius, spacing } from "../shared/theme";
import { SectionHeader } from "./SectionHeader";

interface SettingsGroupProps {
  title?: string;
  description?: string;
  children?: ReactNode;
  /**
   * `list`: grouped rows, no extra padding.
   * `padded`: chips, forms, and custom blocks.
   * `plain`: header only; children keep their own chrome.
   */
  content?: "list" | "padded" | "plain";
}

export function SettingsGroup({
  title,
  description,
  children,
  content = "list",
}: SettingsGroupProps) {
  return (
    <View style={styles.section}>
      {title ? (
        <SectionHeader title={title} description={description} />
      ) : null}
      {children == null ? null : content === "plain" ? (
        <View style={styles.plainBody}>{children}</View>
      ) : (
        <View style={[styles.card, content === "padded" && styles.padded]}>
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  padded: {
    padding: spacing.sm,
    gap: spacing.sm,
  },
  plainBody: {
    gap: spacing.sm,
  },
});
