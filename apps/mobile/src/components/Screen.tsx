import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import type { PropsWithChildren, ReactElement, ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  type RefreshControlProps,
  ScrollView,
  StyleSheet,
  type StyleProp,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, spacing, touchTarget, typography } from "../shared/theme";

interface ScreenProps extends PropsWithChildren {
  title?: string;
  subtitle?: string;
  scroll?: boolean;
  refreshControl?: ReactElement<RefreshControlProps>;
  headerAction?: ReactNode;
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  /**
   * When true, show a back control if the stack can go back.
   * Opt-in only — home/tabs must not inherit a back chevron.
   * Pair with stack `headerShown: false` so Screen owns the intro chrome.
   */
  showBack?: boolean;
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
  showBack = false,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const shouldShowBack = Boolean(showBack && router.canGoBack());

  const content = (
    <>
      {shouldShowBack || title ? (
        <View style={styles.headerBlock}>
          {shouldShowBack ? (
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="이전 화면으로"
              hitSlop={spacing.xs}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.backButtonPressed,
              ]}
            >
              <ChevronLeft
                color={colors.text}
                size={spacing.md}
                strokeWidth={2.4}
              />
            </Pressable>
          ) : null}
          {title ? (
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={styles.title}>{title}</Text>
                {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
              </View>
              {headerAction ? (
                <View style={styles.headerAction}>{headerAction}</View>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
      {children}
    </>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "right", "left"]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        // Screen already sits below the stack header — extra offset double-shifts content.
        keyboardVerticalOffset={0}
      >
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.content, contentStyle]}
            showsVerticalScrollIndicator={false}
            refreshControl={refreshControl}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            {content}
          </ScrollView>
        ) : (
          <View style={[styles.content, styles.staticContent, contentStyle]}>
            {content}
          </View>
        )}
        {footer ? (
          <View
            style={[
              styles.footer,
              { paddingBottom: Math.max(insets.bottom, spacing.md) },
            ]}
          >
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardAvoid: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl + spacing.sm,
    gap: spacing.lg,
  },
  staticContent: {
    flex: 1,
  },
  headerBlock: {
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  backButton: {
    width: touchTarget.icon,
    height: touchTarget.icon,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -spacing.xs,
  },
  backButtonPressed: {
    backgroundColor: colors.surfacePressed,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  headerAction: {
    paddingTop: spacing.none,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  title: {
    fontSize: typography.title.fontSize,
    lineHeight: typography.title.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.text,
  },
  subtitle: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.subtext,
  },
});
