import {
  formatDateKoreanCompact,
  formatInventoryQuantity,
  type InventoryItem,
} from "@expirymate/shared";
import { router } from "expo-router";
import {
  CalendarDays,
  Check,
  ListChecks,
  MapPin,
  Minus,
  Package,
  PenLine,
  Trash2,
} from "lucide-react-native";
import { Pressable, View } from "react-native";
import { AppText } from "../../components/AppText";
import { BottomSheet } from "../../components/BottomSheet";
import { Button } from "../../components/Button";
import { colors, spacing } from "../../shared/theme";
import type { InventoryFacetCounts } from "./filters";
import type { InventoryEditMode } from "./inventory-form-copy";
import { inventoryScreenStyles as styles } from "./inventory-screen-styles";

export function InventoryQuickEditSheet({
  item,
  resolveLocationLabel,
  onClose,
  onEdit,
}: {
  item: InventoryItem | null;
  resolveLocationLabel: (key: string) => string;
  onClose: () => void;
  onEdit: (item: InventoryItem, mode: InventoryEditMode) => void;
}) {
  const expiryLabel = item?.expiryDate
    ? `${formatDateKoreanCompact(item.expiryDate)}까지`
    : "기한 확인 필요";
  const summary = item
    ? `${resolveLocationLabel(item.storageLocation)} · ${formatInventoryQuantity(item)} · ${expiryLabel}`
    : undefined;

  return (
    <BottomSheet
      visible={item !== null}
      onClose={onClose}
      title={item?.displayName ?? "재료 빠르게 바꾸기"}
      description={summary}
    >
      {item ? (
        <View style={styles.entryMethodActions}>
          <Button
            icon={Package}
            onPress={() => onEdit(item, "quantity")}
            fullWidth
            variant="secondary"
          >
            남은 양 바꾸기
          </Button>
          <Button
            icon={CalendarDays}
            onPress={() => onEdit(item, "expiry")}
            fullWidth
            variant="surface"
          >
            유통기한 바꾸기
          </Button>
          <Button
            icon={MapPin}
            onPress={() => onEdit(item, "location")}
            fullWidth
            variant="surface"
          >
            보관 위치 바꾸기
          </Button>
          <Button
            icon={PenLine}
            onPress={() => onEdit(item, "product")}
            fullWidth
            variant="surface"
          >
            전체 내용 수정하기
          </Button>
        </View>
      ) : null}
    </BottomSheet>
  );
}

export function InventoryItemActionsSheet({
  item,
  onClose,
  onUse,
  onEdit,
  onSelect,
  onDiscard,
}: {
  item: InventoryItem | null;
  onClose: () => void;
  onUse: (item: InventoryItem) => void;
  onEdit: (item: InventoryItem) => void;
  onSelect: (item: InventoryItem) => void;
  onDiscard: (item: InventoryItem) => void;
}) {
  return (
    <BottomSheet
      visible={item !== null}
      onClose={onClose}
      title={item?.displayName ?? "재료 더보기"}
      description="할 일을 골라 주세요."
    >
      {item ? (
        <View style={styles.entryMethodActions}>
          <Button
            icon={Minus}
            onPress={() => onUse(item)}
            fullWidth
            variant="secondary"
          >
            사용한 양 빼기
          </Button>
          <Button
            icon={PenLine}
            onPress={() => onEdit(item)}
            fullWidth
            variant="surface"
          >
            내용 수정하기
          </Button>
          <Button
            icon={ListChecks}
            onPress={() => onSelect(item)}
            fullWidth
            variant="surface"
          >
            여러 개 정리하기
          </Button>
          <Button
            icon={Trash2}
            onPress={() => onDiscard(item)}
            fullWidth
            variant="danger"
            accessibilityLabel={`${item.displayName}을 폐기하고 보관함에서 빼기`}
          >
            폐기하고 보관함에서 빼기
          </Button>
        </View>
      ) : null}
    </BottomSheet>
  );
}
export function InventoryListToolsSheet({
  visible,
  onClose,
  selectedLocationLabel,
  hasLocationFilter,
  onOpenLocation,
  onEnterSelectionMode,
}: {
  visible: boolean;
  onClose: () => void;
  selectedLocationLabel: string;
  hasLocationFilter: boolean;
  onOpenLocation: () => void;
  onEnterSelectionMode: () => void;
}) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="보기와 정리"
      description="위치별로 모아 보거나 여러 재료를 한 번에 정리할 수 있어요."
    >
      <View style={styles.entryMethodActions}>
        <Button
          icon={MapPin}
          onPress={onOpenLocation}
          fullWidth
          variant={hasLocationFilter ? "secondary" : "surface"}
          accessibilityLabel={`보관 위치 필터, 현재 ${selectedLocationLabel}`}
        >
          {hasLocationFilter
            ? `${selectedLocationLabel}만 보는 중`
            : "보관 위치 고르기"}
        </Button>
        <Button
          icon={ListChecks}
          onPress={onEnterSelectionMode}
          fullWidth
          variant="surface"
        >
          여러 개 정리하기
        </Button>
      </View>
    </BottomSheet>
  );
}
export function InventoryLocationFilterSheet({
  visible,
  onClose,
  location,
  hasLocationFilter,
  facetCounts,
  options,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  location: string | "all";
  hasLocationFilter: boolean;
  facetCounts: InventoryFacetCounts;
  options: Array<{ key: string; label: string }>;
  onSelect: (next: string | "all") => void;
}) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="보관 위치 선택"
      description="선택한 위치의 재료만 바로 보여 드릴게요."
      footer={
        <View style={styles.locationSheetFooter}>
          {hasLocationFilter ? (
            <Button
              variant="secondary"
              onPress={() => onSelect("all")}
              fullWidth
            >
              전체 위치 보기
            </Button>
          ) : null}
          <Button
            variant="surface"
            onPress={() => {
              onClose();
              router.push("/settings/storage-locations");
            }}
            fullWidth
          >
            보관 위치 관리
          </Button>
        </View>
      }
    >
      <View style={styles.locationOptionGrid}>
        <Pressable
          onPress={() => onSelect("all")}
          accessibilityRole="button"
          accessibilityState={{ selected: location === "all" }}
          accessibilityLabel={`전체 위치, ${facetCounts.locationTotal}개`}
          style={({ pressed }) => [
            styles.locationOption,
            location === "all" && styles.locationOptionSelected,
            pressed && styles.headerFilterButtonPressed,
          ]}
        >
          <AppText
            style={[
              styles.locationOptionLabel,
              location === "all" && styles.locationOptionLabelSelected,
            ]}
          >
            전체 위치
          </AppText>
          <View style={styles.locationOptionMeta}>
            <AppText style={styles.locationOptionCount}>
              {facetCounts.locationTotal}
            </AppText>
            {location === "all" ? (
              <Check
                color={colors.primaryForeground}
                size={spacing.sm}
                strokeWidth={2.8}
              />
            ) : null}
          </View>
        </Pressable>
        {options.map((option) => {
          const selected = location === option.key;
          const count = facetCounts.location[option.key] ?? 0;

          return (
            <Pressable
              key={option.key}
              onPress={() => onSelect(option.key)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${option.label}, ${count}개`}
              accessibilityHint={`${option.label}의 재료만 보여 드릴게요.`}
              style={({ pressed }) => [
                styles.locationOption,
                selected && styles.locationOptionSelected,
                pressed && styles.headerFilterButtonPressed,
              ]}
            >
              <AppText
                style={[
                  styles.locationOptionLabel,
                  selected && styles.locationOptionLabelSelected,
                ]}
              >
                {option.label}
              </AppText>
              <View style={styles.locationOptionMeta}>
                <AppText style={styles.locationOptionCount}>{count}</AppText>
                {selected ? (
                  <Check
                    color={colors.primaryForeground}
                    size={spacing.sm}
                    strokeWidth={2.8}
                  />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}
