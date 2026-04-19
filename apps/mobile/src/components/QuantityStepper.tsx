import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "../shared/theme";

interface QuantityStepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  error?: string;
}

export function QuantityStepper({
  label,
  value,
  onChange,
  error,
}: QuantityStepperProps) {
  const safeValue = Number.isFinite(value) && value > 0 ? value : 1;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.container, error ? styles.errorContainer : null]}>
        <Pressable
          onPress={() => onChange(Math.max(1, safeValue - 1))}
          style={({ pressed }) => [
            styles.iconButton,
            pressed && styles.iconButtonPressed,
          ]}
        >
          <Text style={styles.iconButtonLabel}>-</Text>
        </Pressable>
        <TextInput
          value={String(safeValue)}
          onChangeText={(text) => {
            const nextValue = Number(text.replace(/[^0-9]/g, ""));
            onChange(nextValue > 0 ? nextValue : 1);
          }}
          keyboardType="number-pad"
          style={styles.input}
        />
        <Pressable
          onPress={() => onChange(safeValue + 1)}
          style={({ pressed }) => [
            styles.iconButton,
            pressed && styles.iconButtonPressed,
          ]}
        >
          <Text style={styles.iconButtonLabel}>+</Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
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
  container: {
    minHeight: 58,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  errorContainer: {
    borderColor: colors.danger,
  },
  iconButton: {
    width: 56,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  iconButtonPressed: {
    opacity: 0.82,
  },
  iconButtonLabel: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.primary,
  },
  input: {
    flex: 1,
    alignSelf: "stretch",
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  errorText: {
    fontSize: 13,
    color: colors.danger,
  },
});
