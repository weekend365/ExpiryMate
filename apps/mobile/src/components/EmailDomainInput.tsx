import { forwardRef } from "react";
import type { StyleProp, TextInput, TextInputProps, TextStyle } from "react-native";
import { StyleSheet } from "react-native";
import { colors, radius, spacing, controlSize, typography } from "../shared/theme";
import { AppTextInput } from "./AppTextInput";

type EmailDomainInputProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  placeholderTextColor?: string;
  editable?: boolean;
  style?: StyleProp<TextStyle>;
  returnKeyType?: TextInputProps["returnKeyType"];
  onSubmitEditing?: TextInputProps["onSubmitEditing"];
  textContentType?: TextInputProps["textContentType"];
  autoCorrect?: boolean;
  testID?: string;
};

/**
 * Single full-email field. Domain pickers were removed — users type the address themselves.
 * Component name kept so existing auth screens can keep importing it.
 */
export const EmailDomainInput = forwardRef<TextInput, EmailDomainInputProps>(
  function EmailDomainInput(
    {
      value,
      onChangeText,
      placeholder = "이메일",
      placeholderTextColor = colors.mutedText,
      editable = true,
      style,
      returnKeyType,
      onSubmitEditing,
      textContentType = "emailAddress",
      autoCorrect = false,
      testID,
    },
    ref,
  ) {
    return (
      <AppTextInput
        ref={ref}
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={autoCorrect}
        keyboardType="email-address"
        textContentType={textContentType}
        autoComplete="email"
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
        editable={editable}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        style={[styles.input, style]}
      />
    );
  },
);

const styles = StyleSheet.create({
  input: {
    minHeight: controlSize.cta,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderControl,
    paddingHorizontal: spacing.md,
    fontFamily: typography.body.fontFamily,
  },
});
