import { COUPANG_PARTNERS_CTA_LABEL } from "@expirymate/shared";
import { ExternalLink } from "lucide-react-native";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { AppText } from "../../components/AppText";
import {
  colors,
  radius,
  spacing,
  touchTarget,
  typography,
} from "../../shared/theme";

interface AffiliateCtaProps {
  contextLabel: string;
  mode?: "block" | "inline";
  onPress?: () => void;
  pressed?: boolean;
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
}

/**
 * Single visual and copy contract for every outbound Coupang action.
 * Inline mode is visual feedback inside an already-pressable product card;
 * block mode owns its 48px link target.
 */
export function AffiliateCta({
  contextLabel,
  mode = "block",
  onPress,
  pressed = false,
  disabled = false,
  loading = false,
  accessibilityHint,
}: AffiliateCtaProps) {
  const isDisabled = disabled || loading;
  const foregroundColor = isDisabled ? colors.disabledText : colors.linkText;
  const content = (
    <>
      {loading ? <ActivityIndicator color={foregroundColor} /> : null}
      <AppText
        variant={mode === "inline" ? "captionStrong" : "bodySmallStrong"}
        tone={isDisabled ? "disabled" : "link"}
        scaleRole="chrome"
        densityAware={false}
      >
        {COUPANG_PARTNERS_CTA_LABEL}
      </AppText>
      <ExternalLink
        color={foregroundColor}
        size={
          mode === "inline"
            ? typography.captionStrong.fontSize
            : spacing.sm
        }
        strokeWidth={2.4}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </>
  );
  const visualStyle = [
    styles.base,
    mode === "inline" ? styles.inline : styles.block,
    pressed && styles.pressed,
    isDisabled && styles.disabled,
  ];

  if (!onPress) {
    return <View style={visualStyle}>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="link"
      accessibilityLabel={`${contextLabel}, ${COUPANG_PARTNERS_CTA_LABEL}`}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed: isPressed }) => [
        ...visualStyle,
        isPressed && !isDisabled && styles.pressed,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxs,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  block: {
    minHeight: touchTarget.min,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
  },
  inline: {
    alignSelf: "flex-start",
    borderRadius: radius.md,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  pressed: {
    backgroundColor: colors.primarySoftPressed,
  },
  disabled: {
    backgroundColor: colors.mutedSurface,
  },
});
