import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { formatDateKorean, isDateOnlyString } from "@expirymate/shared";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, touchTarget, typography } from "../shared/theme";
import { BottomSheet } from "./BottomSheet";
import { Button } from "./Button";

interface DatePickerFieldProps {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  error?: string;
}

export function DatePickerField({
  label,
  value,
  onChange,
  error,
}: DatePickerFieldProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [draftDate, setDraftDate] = useState<Date>(
    value ? toDatePickerDate(value) : new Date(),
  );

  const openPicker = () => {
    setDraftDate(value ? toDatePickerDate(value) : new Date());
    setIsVisible(true);
  };

  const closePicker = () => {
    setIsVisible(false);
  };

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

  const displayValue = value ? formatDateKorean(value) : "날짜를 골라 주세요";

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${displayValue}`}
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
        <Text style={styles.triggerAction}>직접 고르기</Text>
      </Pressable>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {Platform.OS === "ios" ? (
        <BottomSheet
          visible={isVisible}
          onClose={closePicker}
          title="언제까지인가요?"
          description="유통기한을 손가락으로 골라 주세요."
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
}

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
