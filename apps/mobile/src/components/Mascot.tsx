import {
  Image,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import mascotSource from "../../assets/characters/mate-fridge-chef.png";
import { colors } from "../shared/theme";

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
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: "118%",
    height: "118%",
  },
});

const sizeStyles = StyleSheet.create({
  small: {
    width: 74,
    height: 74,
    borderRadius: 22,
  },
  medium: {
    width: 112,
    height: 112,
    borderRadius: 28,
  },
  large: {
    width: 164,
    height: 164,
    borderRadius: 36,
  },
});
