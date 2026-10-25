import { Image, StyleSheet, View, type ImageSourcePropType } from "react-native";
import welcomeRoom from "../../assets/backgrounds/welcome-room-bg.png";
import ingredientPrep from "../../assets/backgrounds/ingredient-prep-bg.png";
import cookingWorkspace from "../../assets/backgrounds/cooking-workspace-bg.png";
import settingsStudy from "../../assets/backgrounds/settings-study-bg.png";
import insightsJournal from "../../assets/backgrounds/insights-journal-bg.png";
import sharedTable from "../../assets/backgrounds/shared-table-bg.png";
import { colors, opacity } from "../shared/theme";

const backgroundSources = {
  welcome: welcomeRoom,
  ingredients: ingredientPrep,
  cooking: cookingWorkspace,
  settings: settingsStudy,
  records: insightsJournal,
  sharing: sharedTable,
} satisfies Record<string, ImageSourcePropType>;

export type ScreenBackgroundPreset = keyof typeof backgroundSources;
export type ScreenBackgroundTreatment = "standard" | "reading";

/** Decorative only: no layout, scrolling, focus, or gesture ownership. */
export function ScreenBackground({
  preset,
  treatment = "standard",
}: {
  preset: ScreenBackgroundPreset;
  treatment?: ScreenBackgroundTreatment;
}) {
  return (
    <View
      testID="screen-background"
      pointerEvents="none"
      accessible={false}
      aria-hidden
      focusable={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.layer}
    >
      <Image
        source={backgroundSources[preset]}
        resizeMode="contain"
        style={StyleSheet.absoluteFillObject}
        accessible={false}
        accessibilityIgnoresInvertColors
        fadeDuration={0}
      />
      <View
        style={[
          StyleSheet.absoluteFillObject,
          styles.veil,
          { opacity: treatment === "reading" ? opacity.sceneReadingVeil : opacity.sceneVeil },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.background },
  veil: { backgroundColor: colors.background },
});
