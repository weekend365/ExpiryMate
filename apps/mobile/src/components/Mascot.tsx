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
import jangoPoint from "../../assets/characters/jango-point.png";
import jangoSpeak from "../../assets/characters/jango-speak.png";
import jangoThink from "../../assets/characters/jango-think.png";
import jangoWorry from "../../assets/characters/jango-worry.png";
import jangoCookingSmall from "../../assets/characters/small/jango-cooking-small.png";
import jangoEmptySmall from "../../assets/characters/small/jango-empty-small.png";
import jangoHappySmall from "../../assets/characters/small/jango-happy-small.png";
import jangoIdleSmall from "../../assets/characters/small/jango-idle-small.png";
import jangoPointSmall from "../../assets/characters/small/jango-point-small.png";
import jangoSpeakSmall from "../../assets/characters/small/jango-speak-small.png";
import jangoThinkSmall from "../../assets/characters/small/jango-think-small.png";
import jangoWorrySmall from "../../assets/characters/small/jango-worry-small.png";
import { spacing } from "../shared/theme";

export type MascotMood =
  | "idle"
  | "happy"
  | "worry"
  | "cooking"
  | "empty"
  | "speak"
  | "think"
  | "point";

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
  speak: jangoSpeak,
  think: jangoThink,
  point: jangoPoint,
};

const smallMascotSources: Record<MascotMood, ImageSourcePropType> = {
  idle: jangoIdleSmall,
  happy: jangoHappySmall,
  worry: jangoWorrySmall,
  cooking: jangoCookingSmall,
  empty: jangoEmptySmall,
  speak: jangoSpeakSmall,
  think: jangoThinkSmall,
  point: jangoPointSmall,
};

const moodLabels: Record<MascotMood, string> = {
  idle: "기본",
  happy: "기쁜",
  worry: "걱정하는",
  cooking: "요리하는",
  empty: "빈 냉장고",
  speak: "말하는",
  think: "생각하는",
  point: "가리키는",
};

export function Mascot({ size = "medium", mood = "idle", style }: MascotProps) {
  const source = size === "small" ? smallMascotSources[mood] : mascotSources[mood];

  return (
    <View
      pointerEvents="none"
      style={[styles.frame, sizeStyles[size], style]}
    >
      <Image
        source={source}
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
