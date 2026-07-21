import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { formatDateKorean, isDateOnlyString } from "@expirymate/shared";
import { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, radius, spacing, touchTarget, typography } from "../shared/theme";
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

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={openPicker}
        style={({ pressed }) => [
          styles.trigger,
          pressed && styles.triggerPressed,
          error ? styles.errorTrigger : null,
        ]}
      >
        <Text style={value ? styles.valueText : styles.placeholderText}>
          {value ? formatDateKorean(value) : "날짜를 골라 주세요"}
        </Text>
        <Text style={styles.triggerAction}>직접 고르기</Text>
      </Pressable>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {isVisible ? (
        Platform.OS === "ios" ? (
          <Modal transparent animationType="slide" visible>
            <View style={styles.modalRoot}>
              <Pressable style={styles.backdrop} onPress={closePicker} />
              <View style={styles.sheet}>
                <Text style={styles.sheetTitle}>언제까지인가요?</Text>
                <DateTimePicker
                  value={draftDate}
                  mode="date"
                  display="inline"
                  onChange={handleChange}
                />
                <View style={styles.buttonRow}>
                  <Button variant="secondary" onPress={closePicker} style={styles.button}>
                    그만둘래요
                  </Button>
                  <Button onPress={confirmIOSDate} style={styles.button}>
                    이 날짜로 할게요
                  </Button>
                </View>
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker
            value={value ? toDatePickerDate(value) : new Date()}
            mode="date"
            display="default"
            onChange={handleChange}
          />
        )
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
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.text,
    opacity: 0.28,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sheetTitle: {
    fontSize: typography.subheading.fontSize,
    lineHeight: typography.subheading.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.text,
  },
  buttonRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  button: {
    flex: 1,
  },
});
