import { Controller } from "react-hook-form";
import { KeyboardTypeOptions, StyleSheet, View } from "react-native";
import { colors, radius, spacing, controlSize, typography } from "../shared/theme";
import { AppText } from "./AppText";
import { AppTextInput } from "./AppTextInput";

interface FormFieldProps {
  control: any;
  name: string;
  label: string;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  /** Hide the visible label when a parent already asks the same question. */
  hideLabel?: boolean;
}

export function FormField({
  control,
  name,
  label,
  placeholder,
  keyboardType,
  multiline,
  hideLabel = false,
}: FormFieldProps) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <View style={styles.wrapper}>
          {hideLabel ? null : (
            <AppText variant="bodySmall" scaleRole="body" style={styles.label}>
              {label}
            </AppText>
          )}
          <AppTextInput
            ref={field.ref}
            testID={`form-field-${name}`}
            value={field.value ? String(field.value) : ""}
            onChangeText={field.onChange}
            placeholder={placeholder}
            keyboardType={keyboardType}
            multiline={multiline}
            numberOfLines={multiline ? 4 : 1}
            accessibilityLabel={
              fieldState.error?.message
                ? `${label}, 오류, ${fieldState.error.message}`
                : label
            }
            scaleRole="body"
            textAlignVertical={multiline ? "top" : "center"}
            style={[
              styles.input,
              multiline && styles.multiline,
              fieldState.error && styles.errorInput,
            ]}
          />
          {fieldState.error ? (
            <AppText
              variant="label"
              tone="danger"
              densityAware={false}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
            >
              {fieldState.error.message}
            </AppText>
          ) : null}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  label: {
    fontFamily: typography.label.fontFamily,
  },
  input: {
    minHeight: controlSize.cta,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderControl,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.none,
    includeFontPadding: false,
  },
  multiline: {
    minHeight: spacing.xxxl + spacing.xl,
    paddingVertical: spacing.md,
    textAlignVertical: "top",
  },
  errorInput: {
    borderColor: colors.dangerForeground,
  },
});
