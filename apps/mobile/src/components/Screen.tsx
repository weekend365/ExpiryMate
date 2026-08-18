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
  View,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  type BottomInsetMode,
  type ContentWidthPreset,
  getBottomInsetPadding,
  getContentMaxWidth,
  useResponsiveLayout,
} from "../shared/responsive-layout";
import { colors, radius, spacing, touchTarget } from "../shared/theme";
import { AppText } from "./AppText";

export interface ScreenProps extends PropsWithChildren {
  title?: string;
  subtitle?: string;
  scroll?: boolean;
  refreshControl?: ReactElement<RefreshControlProps>;
  headerAction?: ReactNode;
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  footerStyle?: StyleProp<ViewStyle>;
  /**
   * Constrains content on regular-width windows while compact windows remain fluid.
   * Use `fluid` for full-bleed experiences such as camera previews.
   */
  contentWidth?: ContentWidthPreset;
  /**
   * `system`: this screen owns the Android/iOS bottom safe area.
   * `navigator`: the surrounding tab navigator owns it.
   * `none`: full-screen content intentionally draws to the edge.
   */
  bottomInsetMode?: BottomInsetMode;
  /**
   * `safe`: apply the status-bar inset.
   * `none`: skip it when a stack header already sits in the safe area.
   */
  topInsetMode?: "safe" | "none";
  /**
   * `default`: home/onboarding rhythm (`gap.lg`, `paddingTop.md`).
   * `compact`: preference screens under a native stack header
   * (`gap.md`, `paddingTop.sm`).
   */
  density?: "default" | "compact";
  /**
   * When true, show a back control if the stack can go back.
   * Opt-in only — home/tabs must not inherit a back chevron.
   * Pair with stack `headerShown: false` so Screen owns the intro chrome.
   */
  showBack?: boolean;
  testID?: string;
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
  footerStyle,
  contentWidth = "content",
  bottomInsetMode = "system",
  topInsetMode = "safe",
  density = "default",
  showBack = false,
  testID,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const { width, shouldStack } = useResponsiveLayout();
  const shouldShowBack = Boolean(showBack && router.canGoBack());
  const maxContentWidth = getContentMaxWidth(contentWidth, width);
  const constrainedContentStyle = {
    maxWidth: maxContentWidth,
  };
  const contentBottomPadding = getBottomInsetPadding(
    bottomInsetMode,
    insets.bottom + spacing.md,
    spacing.xxxl + spacing.sm,
  );
  const footerBottomPadding = getBottomInsetPadding(
    bottomInsetMode,
    insets.bottom,
    bottomInsetMode === "none" ? spacing.none : spacing.md,
  );

  const content = (
    <>
      {shouldShowBack || title ? (
        <View style={styles.headerBlock}>
          <View style={[styles.header, shouldStack && styles.headerStacked]}>
            <View style={styles.headerIntro}>
              {shouldShowBack ? (
                <Pressable
                  onPress={() => router.back()}
                  accessibilityRole="button"
                  accessibilityLabel="뒤로가기"
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
                <View style={styles.headerCopy}>
                  <AppText variant="title" style={styles.title}>
                    {title}
                  </AppText>
                  {subtitle ? (
                    <AppText variant="bodySmall" tone="subtext">
                      {subtitle}
                    </AppText>
                  ) : null}
                </View>
              ) : null}
            </View>
            {headerAction ? (
              <View
                style={[
                  styles.headerAction,
                  shouldStack && styles.headerActionStacked,
                ]}
              >
                {headerAction}
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
      {children}
    </>
  );

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={
        topInsetMode === "none"
          ? ["right", "left"]
          : ["top", "right", "left"]
      }
      testID={testID}
    >
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        // Android uses softwareKeyboardLayoutMode=resize; only pad when a sticky
        // footer would otherwise sit under the keyboard inside the resized window.
        behavior={
          Platform.OS === "ios" || footer ? "padding" : undefined
        }
        // Screen already sits below the stack header — extra offset double-shifts content.
        keyboardVerticalOffset={0}
      >
        {scroll ? (
          <ScrollView
            contentContainerStyle={[
              styles.content,
              density === "compact" && styles.contentCompact,
              constrainedContentStyle,
              { paddingBottom: contentBottomPadding },
              contentStyle,
            ]}
            showsVerticalScrollIndicator={false}
            refreshControl={refreshControl}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            {content}
          </ScrollView>
        ) : (
          <View
            style={[
              styles.content,
              density === "compact" && styles.contentCompact,
              styles.staticContent,
              constrainedContentStyle,
              { paddingBottom: contentBottomPadding },
              contentStyle,
            ]}
          >
            {content}
          </View>
        )}
        {footer ? (
          <View
            style={[
              styles.footer,
              footerStyle,
              { paddingBottom: footerBottomPadding },
            ]}
          >
            <View style={[styles.footerContent, constrainedContentStyle]}>
              {footer}
            </View>
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
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.lg,
  },
  contentCompact: {
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  staticContent: {
    flex: 1,
  },
  headerBlock: {
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  headerIntro: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xxs,
  },
  backButton: {
    alignSelf: "flex-start",
    minWidth: touchTarget.icon,
    minHeight: touchTarget.icon,
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
  headerStacked: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: spacing.sm,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  headerAction: {
    flexShrink: 1,
    paddingTop: spacing.none,
  },
  headerActionStacked: {
    alignSelf: "flex-start",
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  footerContent: {
    width: "100%",
    alignSelf: "center",
  },
  title: {
    flexShrink: 1,
  },
});
