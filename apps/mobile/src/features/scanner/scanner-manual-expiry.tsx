import {
  addDays,
  ExpirySource,
  formatDateKorean,
  isDateOnlyString,
  toIsoDate,
} from "@expirymate/shared";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { CalendarDays } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { AppText } from "../../components/AppText";
import { Pill } from "../../components/Pill";
import { colors } from "../../shared/theme";
import { QUICK_EXPIRY_OPTIONS } from "../inventory/inventory-form-copy";
import { scannerScreenStyles as styles } from "./scanner-screen-styles";

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

export function ManualExpirySection({
  expiryDate,
  expirySource,
  onPreset,
  onManualChange,
  onUnknown,
}: {
  expiryDate: string;
  expirySource: ExpirySource;
  onPreset: (days: number) => void;
  onManualChange: (value: string) => void;
  onUnknown: () => void;
}) {
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  const [draftDate, setDraftDate] = useState<Date>(
    expiryDate ? toDatePickerDate(expiryDate) : new Date(),
  );

  useEffect(() => {
    setDraftDate(expiryDate ? toDatePickerDate(expiryDate) : new Date());
  }, [expiryDate]);

  const handleInlineChange = (
    _event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    if (!selectedDate) {
      return;
    }

    setDraftDate(selectedDate);
    const nextDate = toDatePickerDateOnly(selectedDate);
    if (!expiryDate && nextDate === toDatePickerDateOnly(new Date())) {
      return;
    }

    onManualChange(nextDate);
  };

  const handleAndroidChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    setShowAndroidPicker(false);

    if (event.type === "dismissed" || !selectedDate) {
      return;
    }

    onManualChange(toDatePickerDateOnly(selectedDate));
  };

  const displayValue =
    expirySource === ExpirySource.UNKNOWN
      ? "기한 확인 필요"
      : expiryDate
        ? formatDateKorean(expiryDate)
        : "날짜를 골라 주세요";

  return (
    <View style={styles.manualExpiryCard}>
      <AppText style={styles.manualExpiryLabel}>유통기한은 언제까지인가요?</AppText>
      <View style={styles.pillRow}>
        {QUICK_EXPIRY_OPTIONS.map((option) => {
          const presetDate = toIsoDate(addDays(new Date(), option.days));

          return (
            <Pill
              key={option.days}
              label={option.label}
              icon={CalendarDays}
              selected={
                expiryDate === presetDate && expirySource === ExpirySource.PRESET
              }
              onPress={() => onPreset(option.days)}
            />
          );
        })}
        <Pill
          label="기한을 모르겠어요"
          selected={expirySource === ExpirySource.UNKNOWN}
          onPress={onUnknown}
          accessibilityLabel="유통기한을 모르겠어요"
        />
      </View>

      {Platform.OS === "ios" ? (
        <View style={styles.inlinePickerWrap}>
          {!expiryDate ? (
            <AppText style={styles.manualExpiryHint}>
              오늘로 넣으려면 ‘오늘’을 눌러 주세요.
            </AppText>
          ) : null}
          <DateTimePicker
            value={draftDate}
            mode="date"
            display="spinner"
            themeVariant="light"
            accentColor={colors.actionPrimaryBackground}
            locale="ko-KR"
            onChange={handleInlineChange}
            style={styles.inlinePicker}
          />
        </View>
      ) : (
        <>
          <Pressable
            onPress={() => setShowAndroidPicker(true)}
            accessibilityRole="button"
            accessibilityLabel={`유통기한, ${displayValue}`}
            accessibilityHint="날짜를 직접 고를 수 있어요"
            style={({ pressed }) => [
              styles.androidDateTrigger,
              pressed && styles.androidDateTriggerPressed,
            ]}
          >
            <AppText
              variant="bodySmall"
              style={
                expiryDate
                  ? styles.androidDateValue
                  : styles.androidDatePlaceholder
              }
            >
              {displayValue}
            </AppText>
            <AppText style={styles.androidDateAction}>직접 고르기</AppText>
          </Pressable>
          {showAndroidPicker ? (
            <DateTimePicker
              value={expiryDate ? toDatePickerDate(expiryDate) : new Date()}
              mode="date"
              display="default"
              onChange={handleAndroidChange}
            />
          ) : null}
        </>
      )}
    </View>
  );
}
