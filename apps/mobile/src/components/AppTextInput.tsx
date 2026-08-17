import { forwardRef } from "react";
import {
  Platform,
  TextInput,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
} from "react-native";
import {
  getMaxFontSizeMultiplier,
  type FontScaleRole,
} from "../shared/font-scale";
import { colors, typography } from "../shared/theme";

export interface AppTextInputProps extends TextInputProps {
  /** Font-scale cap role. Defaults to body (forms / search). */
  scaleRole?: FontScaleRole;
  style?: StyleProp<TextStyle>;
}

/**
 * TextInput with the shared font-scale policy applied by default.
 */
export const AppTextInput = forwardRef<TextInput, AppTextInputProps>(
  function AppTextInput(
    {
      scaleRole = "body",
      maxFontSizeMultiplier,
      placeholderTextColor = colors.mutedText,
      style,
      ...props
    },
    ref,
  ) {
    return (
      <TextInput
        ref={ref}
        {...props}
        placeholderTextColor={placeholderTextColor}
        maxFontSizeMultiplier={
          maxFontSizeMultiplier ?? getMaxFontSizeMultiplier(scaleRole)
        }
        style={[
          {
            color: colors.text,
            fontSize: typography.body.fontSize,
            fontFamily: typography.body.fontFamily,
            // lineHeight on iOS TextInput sits the glyph low in the box.
            ...(Platform.OS === "android"
              ? {
                  includeFontPadding: false,
                  textAlignVertical: "center",
                }
              : null),
          },
          style,
        ]}
      />
    );
  },
);
