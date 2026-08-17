import {
  QUANTITY_INPUT_UNITS,
  resolveQuantityInputUnit,
} from "@expirymate/shared";
import { StyleSheet, View } from "react-native";
import { Pill } from "../../components/Pill";
import { spacing } from "../../shared/theme";

export function QuantityUnitPills({
  unit,
  onChange,
}: {
  unit?: string | null;
  onChange: (unit: string) => void;
}) {
  const selected = resolveQuantityInputUnit(unit);

  return (
    <View style={styles.row}>
      {QUANTITY_INPUT_UNITS.map((option) => (
        <Pill
          key={option.unit}
          label={option.label}
          selected={selected === option.unit}
          onPress={() => onChange(option.unit)}
          accessibilityLabel={`단위 ${option.label}`}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
});
