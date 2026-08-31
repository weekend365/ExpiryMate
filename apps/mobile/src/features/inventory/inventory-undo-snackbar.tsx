import { Pressable, View } from "react-native";
import { AppText } from "../../components/AppText";
import { spacing } from "../../shared/theme";
import { inventoryScreenStyles as styles } from "./inventory-screen-styles";

export function InventoryUndoSnackbar({
  label,
  stacked,
  onUndo,
}: {
  label: string;
  stacked: boolean;
  onUndo: () => void;
}) {
  return (
    <View
      style={[styles.undoSnackbar, stacked && styles.undoSnackbarStacked]}
      accessibilityLiveRegion="assertive"
      accessibilityLabel={`${label}. 되돌리기 가능`}
    >
      <AppText
        variant="bodySmall"
        tone="inverse"
        numberOfLines={2}
        style={styles.undoSnackbarLabel}
      >
        {label}
      </AppText>
      <Pressable
        onPress={onUndo}
        accessibilityRole="button"
        accessibilityLabel="되돌리기"
        hitSlop={spacing.xs}
        style={({ pressed }) => [
          styles.undoSnackbarAction,
          pressed && styles.undoSnackbarActionPressed,
        ]}
      >
        <AppText
          variant="bodySmall"
          scaleRole="chrome"
          style={styles.undoSnackbarActionLabel}
        >
          되돌리기
        </AppText>
      </Pressable>
    </View>
  );
}
