import type { LucideIcon } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "../../components/AppText";
import { Button } from "../../components/Button";
import { controlSize, radius, spacing } from "../../shared/theme";

export function RegistrationCompletionActions({
  primaryLabel,
  primaryIcon,
  onPrimary,
  onDone,
  tertiaryLabel,
  onTertiary,
  primaryTestID,
  doneTestID,
  tertiaryTestID,
}: {
  primaryLabel: string;
  primaryIcon?: LucideIcon;
  onPrimary: () => void;
  onDone: () => void;
  tertiaryLabel: string;
  onTertiary: () => void;
  primaryTestID?: string;
  doneTestID?: string;
  tertiaryTestID?: string;
}) {
  return (
    <View style={styles.actions}>
      <Button
        icon={primaryIcon}
        onPress={onPrimary}
        fullWidth
        testID={primaryTestID}
      >
        {primaryLabel}
      </Button>
      <Button
        variant="secondary"
        onPress={onDone}
        fullWidth
        testID={doneTestID}
      >
        추가 완료
      </Button>
      <Pressable
        onPress={onTertiary}
        accessibilityRole="button"
        accessibilityLabel={tertiaryLabel}
        testID={tertiaryTestID}
        style={({ pressed }) => [
          styles.tertiaryAction,
          pressed && styles.tertiaryActionPressed,
        ]}
      >
        <AppText variant="bodySmallStrong" tone="link">
          {tertiaryLabel}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.sm,
  },
  tertiaryAction: {
    minHeight: controlSize.minimum,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  tertiaryActionPressed: {
    opacity: 0.72,
  },
});
