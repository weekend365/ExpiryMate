import { Screen, type ScreenProps } from "./Screen";
import { SettingsDensityProvider } from "./settings-density";

/**
 * Preference screens that sit under the native stack header.
 * Compact vertical rhythm; the navigator owns the title and top inset.
 */
export function SettingsScreen({
  topInsetMode = "none",
  density = "compact",
  children,
  ...props
}: ScreenProps) {
  return (
    <SettingsDensityProvider density={density}>
      <Screen {...props} topInsetMode={topInsetMode} density={density}>
        {children}
      </Screen>
    </SettingsDensityProvider>
  );
}
