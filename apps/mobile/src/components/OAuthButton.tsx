import type { OauthBrandProvider } from "@expirymate/shared";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { oauthBrand, radius, spacing, touchTarget, typography } from "../shared/theme";

type OAuthButtonProps = {
  provider: OauthBrandProvider;
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

const ICON_SIZE = spacing.sm + spacing.xxs;

/** Optical scale so logos feel equal despite different glyph mass in the same box. */
const OPTICAL_SCALE: Record<OauthBrandProvider, number> = {
  kakao: 1.08,
  naver: 1.15,
  google: 1,
  apple: 1,
};

export function OAuthButton({
  provider,
  label,
  onPress,
  loading,
  disabled,
}: OAuthButtonProps) {
  const brand = oauthBrand[provider];
  const borderColor = "border" in brand ? brand.border : undefined;
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: Boolean(loading) }}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: brand.background,
          borderColor: borderColor ?? brand.background,
        },
        pressed && !isDisabled && styles.rowPressed,
        isDisabled && styles.rowDisabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={brand.text} />
      ) : (
        <>
          <View style={styles.iconSlot}>
            <View
              style={[
                styles.iconOptical,
                { transform: [{ scale: OPTICAL_SCALE[provider] }] },
              ]}
            >
              <ProviderMark provider={provider} color={brand.text} />
            </View>
          </View>
          <Text style={[styles.label, { color: brand.text }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

function ProviderMark({
  provider,
  color,
}: {
  provider: OauthBrandProvider;
  color: string;
}) {
  switch (provider) {
    case "kakao":
      return <KakaoMark />;
    case "naver":
      return <NaverMark />;
    case "google":
      return <GoogleMark />;
    case "apple":
      return <AppleMark color={color} />;
    default:
      return null;
  }
}

function KakaoMark() {
  return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24">
      <Path
        d="M12 3C6.9 3 2.8 6.2 2.8 10.1c0 2.5 1.7 4.7 4.3 6l-.8 3c-.1.3.3.6.6.4l3.6-2.4c.5.1 1 .1 1.5.1 5.1 0 9.2-3.2 9.2-7.1S17.1 3 12 3z"
        fill="#191919"
      />
    </Svg>
  );
}

function NaverMark() {
  return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24">
      <Path
        d="M15.5 6.5v11h-2.7l-4.1-5.7v5.7H6.5v-11h2.8l4 5.6V6.5h2.2z"
        fill="#FFFFFF"
      />
    </Svg>
  );
}

function GoogleMark() {
  return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </Svg>
  );
}

function AppleMark({ color }: { color: string }) {
  return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24">
      <Path
        d="M16.4 12.7c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3.1-1.6-1.3-.1-2.5.8-3.2.8-.7 0-1.7-.7-2.8-.7-1.4 0-2.8.9-3.5 2.2-1.5 2.6-.4 6.4 1.1 8.5.7 1 1.6 2.1 2.7 2.1 1.1 0 1.5-.7 2.8-.7s1.7.7 2.8.7c1.2 0 1.9-1 2.6-2 .8-1.2 1.1-2.3 1.2-2.4-.1 0-2.2-.8-2.4-3.7zm-2.2-6.4c.6-.7 1-1.7.9-2.7-1 .1-2.1.7-2.7 1.4-.6.7-1 1.6-.9 2.6 1 0 2.1-.6 2.7-1.3z"
        fill={color}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: touchTarget.min,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  rowPressed: {
    opacity: 0.85,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  iconSlot: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  iconOptical: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
  },
});
