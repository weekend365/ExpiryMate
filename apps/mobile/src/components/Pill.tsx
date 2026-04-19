import { Pressable, StyleSheet, Text } from "react-native";
import { colors } from "../shared/theme";

interface PillProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
}

export function Pill({ label, selected, onPress }: PillProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.base,
        selected ? styles.selected : styles.unselected,
      ]}
    >
      <Text style={[styles.label, selected ? styles.selectedLabel : styles.unselectedLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  selected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  unselected: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
  },
  selectedLabel: {
    color: colors.surface,
  },
  unselectedLabel: {
    color: colors.text,
  },
});
