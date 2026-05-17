import type { PropsWithChildren, ReactElement, ReactNode } from "react";
import {
  type RefreshControlProps,
  ScrollView,
  StyleSheet,
  type StyleProp,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "../shared/theme";

interface ScreenProps extends PropsWithChildren {
  title?: string;
  subtitle?: string;
  scroll?: boolean;
  refreshControl?: ReactElement<RefreshControlProps>;
  headerAction?: ReactNode;
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}

export function Screen({
  children,
  title,
  subtitle,
  scroll = true,
  refreshControl,
  headerAction,
  footer,
  contentStyle,
}: ScreenProps) {
  const content = (
    <>
      {title ? (
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {headerAction ? <View style={styles.headerAction}>{headerAction}</View> : null}
        </View>
      ) : null}
      {children}
    </>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "right", "left"]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, contentStyle]}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        >
          {content}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.staticContent, contentStyle]}>{content}</View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl * 2,
    gap: spacing.lg,
  },
  staticContent: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  headerCopy: {
    flex: 1,
    gap: 6,
  },
  headerAction: {
    paddingTop: 2,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "800",
    color: colors.text,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 23,
    color: colors.subtext,
  },
});
