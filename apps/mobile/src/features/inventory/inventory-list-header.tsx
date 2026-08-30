import { Check, SlidersHorizontal, Search, X } from "lucide-react-native";
import { Pressable, ScrollView, View } from "react-native";
import { AppText } from "../../components/AppText";
import { AppTextInput } from "../../components/AppTextInput";
import { colors, spacing } from "../../shared/theme";
import type { InventoryFacetCounts, InventoryViewFilter } from "./filters";
import { inventoryScreenStyles as styles } from "./inventory-screen-styles";

export function InventoryFilterToolbar({
  searchQuery,
  onChangeSearchQuery,
  hasSearchQuery,
  facetCounts,
  filter,
  onSelectExpiryFilter,
  hasLocationFilter,
  onOpenTools,
  hasActiveFilters,
  onClearFilters,
}: {
  searchQuery: string;
  onChangeSearchQuery: (value: string) => void;
  hasSearchQuery: boolean;
  facetCounts: InventoryFacetCounts;
  filter: InventoryViewFilter;
  onSelectExpiryFilter: (next: InventoryViewFilter) => void;
  hasLocationFilter: boolean;
  onOpenTools: () => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}) {
  return (
    <View style={styles.filterToolbar}>
      <View style={styles.searchToolbar}>
        <View style={styles.searchField}>
          <Search
            color={colors.mutedText}
            size={spacing.sm + spacing.xxs}
            strokeWidth={2.4}
          />
          <AppTextInput
            value={searchQuery}
            onChangeText={onChangeSearchQuery}
            placeholder="재료 이름이나 브랜드 검색"
            accessibilityLabel="재료 이름이나 브랜드 검색"
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            style={styles.searchInput}
          />
          {hasSearchQuery ? (
            <Pressable
              onPress={() => onChangeSearchQuery("")}
              accessibilityRole="button"
              accessibilityLabel="검색어 지우기"
              style={({ pressed }) => [
                styles.toolbarIconButton,
                pressed && styles.headerFilterButtonPressed,
              ]}
            >
              <X
                color={colors.subtext}
                size={spacing.sm + spacing.xxs}
                strokeWidth={2.4}
              />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={onOpenTools}
          style={({ pressed }) => [
            styles.moreMenuButton,
            hasLocationFilter && styles.moreMenuButtonActive,
            pressed && styles.headerFilterButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            hasLocationFilter
              ? "위치 필터와 정리 메뉴, 위치 필터 사용 중"
              : "위치 필터와 정리 메뉴"
          }
          accessibilityHint="보관 위치를 고르거나 여러 재료를 한 번에 정리할 수 있어요."
          testID="inventory-tools-button"
        >
          <SlidersHorizontal
            color={hasLocationFilter ? colors.primary : colors.subtext}
            size={spacing.md}
            strokeWidth={2.4}
          />
          {hasLocationFilter ? <View style={styles.activeFilterDot} /> : null}
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.statusChipRow}
        testID="inventory-expiry-filters"
      >
        <InventoryStatusChip
          label="전체"
          count={facetCounts.status.all}
          tone="neutral"
          selected={filter === "all"}
          onPress={() => onSelectExpiryFilter("all")}
          testID="inventory-expiry-filter-all"
        />
        <InventoryStatusChip
          label="만료"
          count={facetCounts.status.expired}
          tone="danger"
          selected={filter === "expired"}
          onPress={() => onSelectExpiryFilter("expired")}
          testID="inventory-expiry-filter-expired"
        />
        <InventoryStatusChip
          label="7일 이내"
          count={facetCounts.status.within7}
          tone="warning"
          selected={filter === "within7"}
          onPress={() => onSelectExpiryFilter("within7")}
          testID="inventory-expiry-filter-within7"
        />
        <InventoryStatusChip
          label="여유"
          count={facetCounts.status.safe}
          tone="success"
          selected={filter === "safe"}
          onPress={() => onSelectExpiryFilter("safe")}
          testID="inventory-expiry-filter-safe"
        />
        {hasActiveFilters ? (
          <Pressable
            onPress={onClearFilters}
            accessibilityRole="button"
            accessibilityLabel="검색과 필터를 모두 풀고 전체 보기"
            style={({ pressed }) => [
              styles.clearFiltersChip,
              pressed && styles.headerFilterButtonPressed,
            ]}
          >
            <X color={colors.subtext} size={spacing.sm} strokeWidth={2.4} />
            <AppText variant="bodySmall" tone="subtext">
              전체 보기
            </AppText>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

function InventoryStatusChip({
  label,
  count,
  tone,
  selected,
  onPress,
  testID,
}: {
  label: string;
  count: number;
  tone: "neutral" | "danger" | "warning" | "success";
  selected: boolean;
  onPress: () => void;
  testID: string;
}) {
  const dotColor = {
    neutral: colors.subtext,
    danger: colors.citrusGrapefruit,
    warning: colors.citrusLemon,
    success: colors.citrusLime,
  }[tone];

  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${count}개`}
      accessibilityState={{ selected }}
      accessibilityHint={`${label} 재료 목록을 보여 드릴게요.`}
      style={({ pressed }) => [
        styles.statusChip,
        selected && styles.statusChipSelected,
        pressed && styles.headerFilterButtonPressed,
      ]}
    >
      {selected ? (
        <Check color={colors.primary} size={spacing.sm} strokeWidth={2.8} />
      ) : (
        <View style={[styles.statusChipDot, { backgroundColor: dotColor }]} />
      )}
      <AppText
        variant="bodySmall"
        style={selected ? styles.statusChipLabelSelected : undefined}
      >
        {label}
      </AppText>
      <AppText
        variant="bodySmallStrong"
        tone={selected ? "primary" : "subtext"}
      >
        {count}
      </AppText>
    </Pressable>
  );
}

export function InventorySelectionBar({
  selectedCount,
  visibleCount,
  expiredVisibleCount,
  onSelectAll,
  onSelectExpired,
  onCancel,
}: {
  selectedCount: number;
  visibleCount: number;
  expiredVisibleCount: number;
  onSelectAll: () => void;
  onSelectExpired: () => void;
  onCancel: () => void;
}) {
  return (
    <View
      style={styles.selectionRow}
      accessibilityLiveRegion="polite"
      accessibilityLabel={
        selectedCount ? `${selectedCount}개 골랐어요` : "재료를 고르는 중이에요"
      }
    >
      <View style={styles.selectionSummary}>
        <AppText style={styles.selectionTitle} numberOfLines={1}>
          {selectedCount ? `${selectedCount}개` : "고를게요"}
        </AppText>
      </View>
      <View style={styles.headerActions}>
        <Pressable
          onPress={onSelectAll}
          disabled={!visibleCount}
          hitSlop={spacing.xs}
          accessibilityRole="button"
          accessibilityLabel="보이는 재료 전부 고를게요"
          accessibilityState={{ disabled: !visibleCount }}
          style={({ pressed }) => [
            styles.headerFilterButton,
            pressed && visibleCount > 0 && styles.headerFilterButtonPressed,
          ]}
        >
          <AppText
            style={[
              styles.headerFilterLabel,
              !visibleCount && styles.headerFilterLabelMuted,
            ]}
          >
            전부
          </AppText>
        </Pressable>
        <Pressable
          onPress={onSelectExpired}
          disabled={!expiredVisibleCount}
          hitSlop={spacing.xs}
          accessibilityRole="button"
          accessibilityLabel="만료된 재료만 고를게요"
          accessibilityState={{ disabled: !expiredVisibleCount }}
          style={({ pressed }) => [
            styles.headerFilterButton,
            pressed &&
              expiredVisibleCount > 0 &&
              styles.headerFilterButtonPressed,
          ]}
        >
          <AppText
            style={[
              styles.headerFilterLabel,
              !expiredVisibleCount && styles.headerFilterLabelMuted,
            ]}
          >
            만료만
          </AppText>
        </Pressable>
        <Pressable
          onPress={onCancel}
          hitSlop={spacing.xs}
          style={({ pressed }) => [
            styles.headerFilterButton,
            pressed && styles.headerFilterButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="선택 닫기"
        >
          <AppText style={styles.headerFilterLabel}>닫기</AppText>
        </Pressable>
      </View>
    </View>
  );
}
