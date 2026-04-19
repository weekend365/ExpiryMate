import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { formatDateKorean, toIsoDate } from "@expirymate/shared";
import { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, spacing } from "../shared/theme";
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
    value ? new Date(value) : new Date(),
  );

  const openPicker = () => {
    setDraftDate(value ? new Date(value) : new Date());
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

      onChange(toIsoDate(selectedDate));
      return;
    }

    if (selectedDate) {
      setDraftDate(selectedDate);
    }
  };

  const confirmIOSDate = () => {
    onChange(toIsoDate(draftDate));
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
          {value ? formatDateKorean(value) : "유통기한을 선택해주세요"}
        </Text>
        <Text style={styles.triggerAction}>직접 선택</Text>
      </Pressable>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {isVisible ? (
        Platform.OS === "ios" ? (
          <Modal transparent animationType="slide" visible>
            <View style={styles.modalRoot}>
              <Pressable style={styles.backdrop} onPress={closePicker} />
              <View style={styles.sheet}>
                <Text style={styles.sheetTitle}>유통기한 선택</Text>
                <DateTimePicker
                  value={draftDate}
                  mode="date"
                  display="inline"
                  onChange={handleChange}
                />
                <View style={styles.buttonRow}>
                  <Button variant="secondary" onPress={closePicker} style={styles.button}>
                    취소
                  </Button>
                  <Button onPress={confirmIOSDate} style={styles.button}>
                    선택
                  </Button>
                </View>
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker
            value={value ? new Date(value) : new Date()}
            mode="date"
            display="default"
            onChange={handleChange}
          />
        )
      ) : null}
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
  trigger: {
    minHeight: 58,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    justifyContent: "space-between",
    gap: 6,
  },
  triggerPressed: {
    opacity: 0.85,
  },
  errorTrigger: {
    borderColor: colors.danger,
  },
  valueText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  placeholderText: {
    fontSize: 15,
    color: colors.subtext,
  },
  triggerAction: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: "700",
  },
  errorText: {
    fontSize: 13,
    color: colors.danger,
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(31, 41, 51, 0.28)",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "800",
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
