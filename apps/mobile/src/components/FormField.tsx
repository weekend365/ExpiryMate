import { Controller } from "react-hook-form";
import {
  KeyboardTypeOptions,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors, spacing } from "../shared/theme";

interface FormFieldProps {
  control: any;
  name: string;
  label: string;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
}

export function FormField({
  control,
  name,
  label,
  placeholder,
  keyboardType,
  multiline,
}: FormFieldProps) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <View style={styles.wrapper}>
          <Text style={styles.label}>{label}</Text>
          <TextInput
            value={field.value ? String(field.value) : ""}
            onChangeText={field.onChange}
            placeholder={placeholder}
            keyboardType={keyboardType}
            multiline={multiline}
            numberOfLines={multiline ? 4 : 1}
            style={[
              styles.input,
              multiline && styles.multiline,
              fieldState.error && styles.errorInput,
            ]}
          />
          {fieldState.error ? (
            <Text style={styles.errorText}>{fieldState.error.message}</Text>
          ) : null}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  input: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 15,
  },
  multiline: {
    minHeight: 110,
    paddingVertical: spacing.md,
    textAlignVertical: "top",
  },
  errorInput: {
    borderColor: colors.danger,
  },
  errorText: {
    fontSize: 13,
    color: colors.danger,
  },
});
