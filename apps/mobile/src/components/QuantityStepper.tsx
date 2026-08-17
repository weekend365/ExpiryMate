import { Pressable, StyleSheet, View } from "react-native";
import { colors, radius, spacing, touchTarget, typography } from "../shared/theme";
import { AppText } from "./AppText";
import { AppTextInput } from "./AppTextInput";

interface QuantityStepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  /** Inclusive upper bound for cooking / partial-use flows. */
  max?: number;
  /** Amount added or subtracted by the +/− buttons. Defaults to 1. */
  step?: number;
  error?: string;
  /** Shown beside the number so the hero reads as a complete value (e.g. 2개). */
  unitSuffix?: string;
  /** `hero` enlarges the number and hides the field label when the page title already asks. */
  presentation?: "field" | "hero";
}

export function QuantityStepper({
  label,
  value,
  onChange,
  max,
  step = 1,
  error,
  unitSuffix,
  presentation = "field",
}: QuantityStepperProps) {
  const upperBound =
    typeof max === "number" && Number.isFinite(max) && max >= 1
      ? Math.floor(max)
      : undefined;
  const safeStep =
    Number.isFinite(step) && step >= 1 ? Math.floor(step) : 1;
  const safeValue = Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
  const clampedValue =
    upperBound === undefined ? safeValue : Math.min(safeValue, upperBound);

  const isHero = presentation === "hero";
  const valueText = String(clampedValue);
  const valueVariant = isHero ? "title" : "subheading";

  const commitQuantity = (text: string) => {
    const nextValue = Number(text.replace(/[^0-9]/g, ""));
    const normalized = nextValue > 0 ? nextValue : 1;
    onChange(
      upperBound === undefined ? normalized : Math.min(normalized, upperBound),
    );
  };

  return (
    <View style={styles.wrapper}>
      {isHero ? null : (
        <AppText variant="bodySmall" scaleRole="body" style={styles.label}>
          {label}
        </AppText>
      )}
      <View
        style={[
          styles.container,
          isHero && styles.containerHero,
          error ? styles.errorContainer : null,
        ]}
      >
        <Pressable
          onPress={() => {
            if (clampedValue <= safeStep) {
              onChange(1);
              return;
            }
            onChange(clampedValue - safeStep);
          }}
          hitSlop={spacing.xxs}
          accessibilityRole="button"
          accessibilityLabel={`${label} 줄이기`}
          style={({ pressed }) => [
            styles.iconButton,
            pressed && styles.iconButtonPressed,
          ]}
        >
          <AppText
            variant="heading"
            scaleRole="chrome"
            densityAware={false}
            style={styles.iconButtonLabel}
          >
            -
          </AppText>
        </Pressable>
        <View style={styles.valueCluster}>
          {unitSuffix ? (
            <View style={styles.valuePair}>
              <View style={styles.valueMeasureWrap}>
                <AppText
                  variant={valueVariant}
                  scaleRole="chrome"
                  densityAware={false}
                  accessible={false}
                  importantForAccessibility="no"
                  style={styles.valueMeasure}
                >
                  {valueText}
                </AppText>
                <AppTextInput
                  value={valueText}
                  onChangeText={commitQuantity}
                  keyboardType="number-pad"
                  accessibilityLabel={`${label} 수량 ${unitSuffix}`}
                  scaleRole="chrome"
                  caretHidden={false}
                  underlineColorAndroid="transparent"
                  selectionColor={colors.primary}
                  textAlignVertical="center"
                  style={[
                    styles.input,
                    styles.inputOverlay,
                    isHero && styles.inputHero,
                  ]}
                />
              </View>
              <AppText
                variant={valueVariant}
                scaleRole="chrome"
                densityAware={false}
                style={styles.unitSuffix}
              >
                {unitSuffix}
              </AppText>
            </View>
          ) : (
            <AppTextInput
              value={valueText}
              onChangeText={commitQuantity}
              keyboardType="number-pad"
              accessibilityLabel={`${label} 수량`}
              scaleRole="chrome"
              style={[
                styles.input,
                styles.inputFill,
                isHero && styles.inputHero,
              ]}
            />
          )}
        </View>
        <Pressable
          onPress={() => {
            const next =
              clampedValue < safeStep ? safeStep : clampedValue + safeStep;
            onChange(
              upperBound === undefined ? next : Math.min(next, upperBound),
            );
          }}
          hitSlop={spacing.xxs}
          accessibilityRole="button"
          accessibilityLabel={`${label} 늘리기`}
          disabled={upperBound !== undefined && clampedValue >= upperBound}
          style={({ pressed }) => [
            styles.iconButton,
            pressed && styles.iconButtonPressed,
            upperBound !== undefined &&
              clampedValue >= upperBound &&
              styles.iconButtonDisabled,
          ]}
        >
          <AppText
            variant="heading"
            scaleRole="chrome"
            densityAware={false}
            style={styles.iconButtonLabel}
          >
            +
          </AppText>
        </Pressable>
      </View>
      {error ? (
        <AppText variant="label" tone="danger" densityAware={false}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  label: {
    fontFamily: typography.label.fontFamily,
  },
  container: {
    minHeight: touchTarget.ctaLarge,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  containerHero: {
    minHeight: touchTarget.ctaLarge + spacing.xs,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  errorContainer: {
    borderColor: colors.danger,
  },
  iconButton: {
    minWidth: touchTarget.ctaLarge,
    minHeight: touchTarget.ctaLarge,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.primarySoft,
  },
  iconButtonPressed: {
    backgroundColor: colors.primarySoftPressed,
  },
  iconButtonDisabled: {
    opacity: 0.45,
  },
  iconButtonLabel: {
    color: colors.primary,
  },
  valueCluster: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  valuePair: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxs, // 숫자와 단위를 한 값으로 붙여 읽기 위한 4px 시각 보정
  },
  valueMeasureWrap: {
    justifyContent: "center",
  },
  valueMeasure: {
    includeFontPadding: false,
  },
  input: {
    margin: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    backgroundColor: "transparent",
    fontSize: typography.subheading.fontSize,
    lineHeight: typography.subheading.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
  },
  inputOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    color: "transparent",
    textAlign: "right",
  },
  inputFill: {
    flex: 1,
    alignSelf: "stretch",
    minHeight: touchTarget.ctaLarge,
    textAlign: "center",
  },
  inputHero: {
    fontSize: typography.title.fontSize,
    lineHeight: typography.title.lineHeight,
    fontFamily: typography.title.fontFamily,
  },
  unitSuffix: {
    color: colors.text,
    includeFontPadding: false,
  },
});
