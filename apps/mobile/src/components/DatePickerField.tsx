import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { formatDateKorean, isDateOnlyString } from "@expirymate/shared";
import { forwardRef, useCallback, useImperativeHandle, useState, type PropsWithChildren } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, touchTarget, typography } from "../shared/theme";
import { BottomSheet } from "./BottomSheet";
import { Button } from "./Button";

export type DatePickerFieldHandle = {
  open: () => void;
};

interface DatePickerFieldProps extends PropsWithChildren {
  label?: string;
  value?: string;
  onChange: (value: string) => void;
  error?: string;
  /** field = labeled row; hero = large date; none = parent trigger opens the sheet */
  presentation?: "field" | "hero" | "none";
  actionLabel?: string;
  emptyLabel?: string;
  /** Hero eyebrow above the large date. Pass null to hide when a parent already guides. */
  heroEyebrow?: string | null;
}

export const DatePickerField = forwardRef<
  DatePickerFieldHandle,
  DatePickerFieldProps
>(function DatePickerField(
  {
    label,
    value,
    onChange,
    error,
    presentation = "field",
    actionLabel,
    emptyLabel = "날짜를 골라 주세요",
    heroEyebrow = "이 날짜로 넣을게요",
    children,
  },
  ref,
) {
  const [isVisible, setIsVisible] = useState(false);
  const [draftDate, setDraftDate] = useState<Date>(
    value ? toDatePickerDate(value) : new Date(),
  );

  const openPicker = useCallback(() => {
    setDraftDate(value ? toDatePickerDate(value) : new Date());
    setIsVisible(true);
  }, [value]);

  const closePicker = () => {
    setIsVisible(false);
  };

  useImperativeHandle(ref, () => ({ open: openPicker }), [openPicker]);

  const handleChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setIsVisible(false);

      if (event.type === "dismissed" || !selectedDate) {
        return;
      }

      onChange(toDatePickerDateOnly(selectedDate));
      return;
    }

    if (selectedDate) {
      setDraftDate(selectedDate);
    }
  };

  const confirmIOSDate = () => {
    onChange(toDatePickerDateOnly(draftDate));
    setIsVisible(false);
  };

  const displayValue = value ? formatDateKorean(value) : emptyLabel;
  const resolvedActionLabel =
    actionLabel ??
    (presentation === "hero" ? "다른 날짜 고르기" : "직접 고르기");
  const isHero = presentation === "hero";
  const isHidden = presentation === "none";

  return (
    <View style={[styles.wrapper, isHero && styles.wrapperHero]}>
      {label && !isHero && !isHidden ? (
        <Text style={styles.label}>{label}</Text>
      ) : null}

      {isHidden ? (
        children
      ) : isHero ? (
        <>
          <Pressable
            onPress={openPicker}
            accessibilityRole="button"
            accessibilityLabel={`선택한 유통기한 ${displayValue}`}
            accessibilityHint="다른 날짜를 고르려면 눌러 주세요"
            style={({ pressed }) => [
              styles.heroValueBlock,
              pressed && styles.heroValueBlockPressed,
              error ? styles.errorTrigger : null,
            ]}
          >
            {heroEyebrow ? (
              <Text style={styles.heroEyebrow}>{heroEyebrow}</Text>
            ) : null}
            <Text
              style={[
                styles.heroValue,
                !value && styles.heroValuePlaceholder,
              ]}
            >
              {displayValue}
            </Text>
          </Pressable>

          {children}

          <Pressable
            onPress={openPicker}
            accessibilityRole="button"
            accessibilityLabel={resolvedActionLabel}
            accessibilityHint="달력에서 유통기한을 직접 고를 수 있어요"
            style={({ pressed }) => [
              styles.heroAction,
              pressed && styles.heroActionPressed,
            ]}
          >
            <Text style={styles.heroActionLabel}>{resolvedActionLabel}</Text>
          </Pressable>
        </>
      ) : (
        <Pressable
          onPress={openPicker}
          accessibilityRole="button"
          accessibilityLabel={`${label ?? "날짜"}, ${displayValue}`}
          accessibilityHint="날짜를 직접 고를 수 있어요"
          style={({ pressed }) => [
            styles.trigger,
            pressed && styles.triggerPressed,
            error ? styles.errorTrigger : null,
          ]}
        >
          <Text style={value ? styles.valueText : styles.placeholderText}>
            {displayValue}
          </Text>
          <Text style={styles.triggerAction}>{resolvedActionLabel}</Text>
        </Pressable>
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {Platform.OS === "ios" ? (
        <BottomSheet
          visible={isVisible}
          onClose={closePicker}
          title="언제까지인가요?"
          description="유통기한을 손가락으로 골라 주세요."
          scrollEnabled={false}
          footer={
            <View style={styles.buttonRow}>
              <Button
                variant="secondary"
                onPress={closePicker}
                style={styles.button}
              >
                그만둘래요
              </Button>
              <Button onPress={confirmIOSDate} style={styles.button}>
                이 날짜로 할게요
              </Button>
            </View>
          }
        >
          <View style={styles.pickerWrap}>
            <DateTimePicker
              value={draftDate}
              mode="date"
              display="inline"
              // Light sheet + dark-mode device → white labels on white (invisible).
              themeVariant="light"
              accentColor={colors.primary}
              locale="ko-KR"
              onChange={handleChange}
              style={styles.picker}
            />
          </View>
        </BottomSheet>
      ) : isVisible ? (
        <DateTimePicker
          value={value ? toDatePickerDate(value) : new Date()}
          mode="date"
          display="default"
          onChange={handleChange}
        />
      ) : null}
    </View>
  );
});

function toDatePickerDate(value: string) {
  if (!isDateOnlyString(value)) {
    return new Date(value);
  }

  const [yearText, monthText, dayText] = value.split("-");
  return new Date(Number(yearText), Number(monthText) - 1, Number(dayText));
}

function toDatePickerDateOnly(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
  },
  wrapperHero: {
    gap: spacing.xs,
  },
  label: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.text,
  },
  trigger: {
    minHeight: touchTarget.ctaLarge,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    justifyContent: "space-between",
    gap: spacing.xs,
  },
  triggerPressed: {
    backgroundColor: colors.surfacePressed,
  },
  errorTrigger: {
    borderColor: colors.danger,
  },
  valueText: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  placeholderText: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.body.fontFamily,
    color: colors.mutedText,
  },
  triggerAction: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    color: colors.primary,
    fontFamily: typography.label.fontFamily,
  },
  heroValueBlock: {
    minHeight: touchTarget.cta,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    justifyContent: "center",
    gap: spacing.xxs, // 날짜와 캡션을 한 덩어리로 붙이기 위한 4px 시각 보정
  },
  heroValueBlockPressed: {
    opacity: 0.88,
  },
  heroEyebrow: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.caption.fontFamily,
    color: colors.primary,
  },
  heroValue: {
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
    fontFamily: typography.heading.fontFamily,
    color: colors.text,
  },
  heroValuePlaceholder: {
    color: colors.mutedText,
    fontFamily: typography.body.fontFamily,
  },
  heroAction: {
    minHeight: touchTarget.min,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  heroActionPressed: {
    backgroundColor: colors.surfacePressed,
  },
  heroActionLabel: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.primary,
  },
  errorText: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.danger,
  },
  buttonRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  button: {
    flex: 1,
  },
  pickerWrap: {
    alignItems: "center",
    width: "100%",
  },
  picker: {
    alignSelf: "center",
  },
});
