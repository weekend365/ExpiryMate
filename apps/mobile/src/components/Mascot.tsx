import { appBrand } from "@expirymate/shared";
import {
  Image,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import jangoCooking from "../../assets/characters/jango-cooking.png";
import jangoEmpty from "../../assets/characters/jango-empty.png";
import jangoHappy from "../../assets/characters/jango-happy.png";
import jangoIdle from "../../assets/characters/jango-idle.png";
import jangoWorry from "../../assets/characters/jango-worry.png";
import { spacing } from "../shared/theme";

export type MascotMood = "idle" | "happy" | "worry" | "cooking" | "empty";

interface MascotProps {
  size?: "small" | "medium" | "large";
  mood?: MascotMood;
  style?: StyleProp<ViewStyle>;
}

const mascotSources: Record<MascotMood, ImageSourcePropType> = {
  idle: jangoIdle,
  happy: jangoHappy,
  worry: jangoWorry,
  cooking: jangoCooking,
  empty: jangoEmpty,
};

const moodLabels: Record<MascotMood, string> = {
  idle: "기본",
  happy: "기쁜",
  worry: "걱정하는",
  cooking: "요리하는",
  empty: "빈 냉장고",
};

export function Mascot({ size = "medium", mood = "idle", style }: MascotProps) {
  return (
    <View
      pointerEvents="none"
      style={[styles.frame, sizeStyles[size], style]}
    >
      <Image
        source={mascotSources[mood]}
        style={styles.image}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
        accessibilityLabel={`${appBrand.characterNameKo}, ${moodLabels[mood]} 표정`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
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
