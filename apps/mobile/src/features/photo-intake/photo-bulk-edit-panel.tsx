import { ExpirySource, formatDateKorean } from "@expirymate/shared";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppText } from "../../components/AppText";
import { Button } from "../../components/Button";
import { FeedbackBanner } from "../../components/FeedbackBanner";
import { colors, radius, spacing } from "../../shared/theme";
import { QuickExpiryPills } from "../inventory/inventory-form-ui";
import type { PhotoIntakeDraftItem } from "./photo-intake-draft";
import { applyPhotoBulkChange, photoBulkTargets, type PhotoBulkChange, type PhotoBulkScope } from "./photo-bulk-edit";

export function PhotoBulkEditPanel({ items, locations, onChange }: {
  items: PhotoIntakeDraftItem[];
  locations: Array<{ key: string; label: string }>;
  onChange: (expected: PhotoIntakeDraftItem[], next: PhotoIntakeDraftItem[]) => void;
}) {
  const [scopes, setScopes] = useState<Record<PhotoBulkChange["field"], PhotoBulkScope>>({ location: "missing", expiry: "missing" });
  const [pending, setPending] = useState<{ before: PhotoIntakeDraftItem[]; change: PhotoBulkChange; label: string } | null>(null);
  const [undo, setUndo] = useState<{ before: PhotoIntakeDraftItem[]; after: PhotoIntakeDraftItem[]; message: string } | null>(null);

  const apply = (change: PhotoBulkChange, scope: PhotoBulkScope) => {
    const result = applyPhotoBulkChange(items, change, scope);
    setPending(null);
    if (!result.changedCount) return;
    onChange(items, result.items);
    setUndo({ before: items, after: result.items, message: `재료 ${result.changedCount}개의 ${change.field === "location" ? "보관 위치를" : "유통기한을"} 변경했어요.` });
  };
  const choose = (change: PhotoBulkChange, label: string) => {
    if (scopes[change.field] === "all") {
      setPending({ before: items, change, label });
    } else {
      apply(change, "missing");
    }
  };

  return (
    <View style={styles.panel} testID="photo-bulk-edit-panel">
      <AppText variant="subheading">한 번에 수정하기</AppText>
      {(["location", "expiry"] as const).map((field) => {
        const targets = photoBulkTargets(items, field, scopes[field]);
        return (
          <View key={field} style={styles.group}>
            <AppText variant="bodyStrong">{field === "location" ? "보관 위치" : "유통기한"} · 적용 대상 {targets.length}개</AppText>
            <View style={styles.modes}>
              {(["missing", "all"] as const).map((scope) => (
                <Button
                  key={scope}
                  size="small"
                  variant={scopes[field] === scope ? "secondary" : "surface"}
                  accessibilityLabel={`${field === "location" ? "보관 위치" : "유통기한"}, ${scope === "missing" ? "미입력만 채우기" : "전체 덮어쓰기"}${scopes[field] === scope ? ", 선택됨" : ""}`}
                  onPress={() => { setScopes((current) => ({ ...current, [field]: scope })); setPending(null); }}
                >
                  {scope === "missing" ? "미입력만 채우기" : "전체 덮어쓰기"}
                </Button>
              ))}
            </View>
            {targets.length === 0 ? (
              <AppText variant="bodySmall" tone="subtext">미입력 항목이 없어요. 기존 값을 바꾸려면 전체 덮어쓰기를 선택해 주세요.</AppText>
            ) : field === "location" ? (
              <View style={styles.modes}>
                {locations.map((location) => (
                  <Button key={location.key} variant="surface" size="small" onPress={() => choose({ field, storageLocation: location.key }, location.label)}>{location.label}</Button>
                ))}
              </View>
            ) : (
              <>
                <QuickExpiryPills
                  isSelected={(date) => targets.length > 0 && targets.every((item) => item.expiryDate === date)}
                  onSelect={(date) => choose({ field, expiryDate: date, expirySource: ExpirySource.PRESET }, formatDateKorean(date))}
                />
                <Button variant="surface" size="small" onPress={() => choose({ field, expiryDate: null, expirySource: ExpirySource.UNKNOWN }, "기한 모름")}>기한 모름으로 설정</Button>
              </>
            )}
          </View>
        );
      })}
      {pending?.before === items ? (
        <View style={styles.group} testID="photo-bulk-overwrite-confirmation">
          <AppText variant="bodyStrong">재료 {items.length}개의 {pending.change.field === "location" ? "보관 위치를" : "유통기한을"} ‘{pending.label}’로 덮어쓸까요?</AppText>
          <AppText variant="bodySmall" tone="subtext">이미 입력하거나 개별 수정한 값도 바뀌어요.</AppText>
          <Button variant="secondary" onPress={() => apply(pending.change, "all")}>{`${items.length}개 덮어쓰기`}</Button>
          <Button variant="surface" onPress={() => setPending(null)}>취소</Button>
        </View>
      ) : null}
      {undo?.after === items ? (
        <FeedbackBanner
          tone="success"
          title={undo.message}
          actionLabel="되돌리기"
          onAction={() => { onChange(undo.after, undo.before); setUndo(null); setPending(null); }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing.sm, padding: spacing.sm, borderRadius: radius.xl, backgroundColor: colors.surfaceWarm },
  group: { gap: spacing.xs },
  modes: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
});
