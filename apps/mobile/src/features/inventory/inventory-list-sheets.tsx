import { router } from "expo-router";
import { Barcode, Check, ImageIcon, PenLine } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { AppText } from "../../components/AppText";
import { BottomSheet } from "../../components/BottomSheet";
import { Button } from "../../components/Button";
import { colors, spacing } from "../../shared/theme";
import type { InventoryFacetCounts } from "./filters";
import { inventoryScreenStyles as styles } from "./inventory-screen-styles";

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
                color={colors.primary}
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
                    color={colors.primary}
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

export function InventoryEntryMethodSheet({
  visible,
  onClose,
  onScan,
  onManual,
  onPhoto,
}: {
  visible: boolean;
  onClose: () => void;
  onScan: () => void;
  onManual: () => void;
  onPhoto?: () => void;
}) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="어떻게 넣을까요?"
      description={
        onPhoto
          ? "바코드를 비추거나, 사진으로 여러 가지를 넣거나, 직접 입력할 수 있어요."
          : "바코드를 비추거나, 직접 입력해서 냉장고에 넣을 수 있어요."
      }
      mascotMood="idle"
    >
      <View style={styles.entryMethodActions}>
        <Button icon={Barcode} onPress={onScan} fullWidth variant="primary">
          바코드로 넣을래요
        </Button>
        {onPhoto ? (
          <Button icon={ImageIcon} onPress={onPhoto} fullWidth variant="surface">
            사진으로 넣을게요
          </Button>
        ) : null}
        <Button icon={PenLine} onPress={onManual} fullWidth variant="surface">
          직접 입력할게요
        </Button>
      </View>
    </BottomSheet>
  );
}
