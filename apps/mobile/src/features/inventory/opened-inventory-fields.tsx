import { toKstDateOnly } from "@expirymate/shared";
import { StyleSheet, View } from "react-native";
import { AppText } from "../../components/AppText";
import { Button } from "../../components/Button";
import { DatePickerField } from "../../components/DatePickerField";
import { spacing } from "../../shared/theme";

export function OpenedInventoryFields({
  openedDate,
  openedCheckDate,
  onChange,
  error,
}: {
  openedDate?: string | null;
  openedCheckDate?: string | null;
  onChange: (openedDate: string | null, openedCheckDate: string | null) => void;
  error?: string;
}) {
  return (
    <View style={styles.section}>
      <AppText variant="bodyStrong">개봉 후 관리</AppText>
      {openedDate ? (
        <>
          <DatePickerField
            label="개봉일"
            value={openedDate}
            onChange={(date) => onChange(date, openedCheckDate ?? null)}
          />
          <DatePickerField
            label="개봉 후 확인일"
            value={openedCheckDate}
            onChange={(date) => onChange(openedDate, date)}
          />
          <AppText variant="caption" tone="muted">
            포장 안내를 보고 확인일을 직접 골라 주세요. 섭취 가능 기한을 뜻하지
            않으며, 원래 유통기한은 유지돼요. 알림은 설정한 날짜 간격과 시간에
            맞춰 보내요.
          </AppText>
          {openedCheckDate ? (
            <Button
              variant="surface"
              onPress={() => onChange(openedDate, null)}
            >
              확인일 지우기
            </Button>
          ) : null}
          <Button variant="surface" onPress={() => onChange(null, null)}>
            개봉 기록 지우기
          </Button>
        </>
      ) : (
        <Button
          variant="secondary"
          onPress={() => onChange(toKstDateOnly(new Date()), null)}
        >
          개봉 기록하기
        </Button>
      )}
      {error ? (
        <AppText tone="danger" variant="caption">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({ section: { gap: spacing.sm } });
