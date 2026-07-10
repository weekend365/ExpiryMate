import {
  Image,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import mascotSource from "../../assets/characters/mate-fridge-chef.png";
import { colors, radius, spacing } from "../shared/theme";

interface MascotProps {
  size?: "small" | "medium" | "large";
  style?: StyleProp<ViewStyle>;
}

export function Mascot({ size = "medium", style }: MascotProps) {
  return (
    <View
      pointerEvents="none"
      style={[styles.frame, sizeStyles[size], style]}
    >
      <Image
        source={mascotSource}
        style={styles.image}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
        accessibilityLabel="ExpiryMate 냉장고 셰프 마스코트"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.xxl,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
});

const sizeStyles = StyleSheet.create({
  small: {
    width: spacing.xxxl + spacing.xs,
    height: spacing.xxxl + spacing.xs,
  },
  medium: {
    width: spacing.xxxl + spacing.xl + spacing.xs,
    height: spacing.xxxl + spacing.xl + spacing.xs,
  },
  large: {
    width: spacing.xxxl + spacing.xxxl + spacing.lg,
    height: spacing.xxxl + spacing.xxxl + spacing.lg,
  },
});
