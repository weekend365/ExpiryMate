import { ListChecks, MapPin, RefreshCw, Search, X } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { AppText } from "../../components/AppText";
import { AppTextInput } from "../../components/AppTextInput";
import { colors, spacing } from "../../shared/theme";
import type { InventoryFacetCounts, InventoryViewFilter } from "./filters";
import { inventoryScreenStyles as styles } from "./inventory-screen-styles";
import { ExpiryTrafficLamp } from "./inventory-urgency-section";

export function InventoryFilterToolbar({
  heroContent,
  heroTone,
  shouldStackDense,
  searchQuery,
  onChangeSearchQuery,
  hasSearchQuery,
  onEnterSelectionMode,
  facetCounts,
  filter,
  onToggleExpiryFilter,
  hasLocationFilter,
  selectedLocationLabel,
  onOpenLocationFilter,
  hasActiveFilters,
  onClearFilters,
}: {
  heroContent: ReactNode;
  heroTone?: "danger" | "warning" | "success" | "neutral";
  shouldStackDense: boolean;
  searchQuery: string;
  onChangeSearchQuery: (value: string) => void;
  hasSearchQuery: boolean;
  onEnterSelectionMode: () => void;
  facetCounts: InventoryFacetCounts;
  filter: InventoryViewFilter;
  onToggleExpiryFilter: (next: Exclude<InventoryViewFilter, "all">) => void;
  hasLocationFilter: boolean;
  selectedLocationLabel: string;
  onOpenLocationFilter: () => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}) {
  return (
    <View
      style={[
        styles.filterToolbar,
        heroTone === "danger" && styles.filterToolbarDangerNotice,
        heroTone === "warning" && styles.filterToolbarWarningNotice,
        heroTone === "success" && styles.filterToolbarSuccessNotice,
        heroTone === "neutral" && styles.filterToolbarNeutralNotice,
      ]}
    >
      {heroContent}
      <View style={styles.filterCluster}>
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
            onPress={onEnterSelectionMode}
            style={({ pressed }) => [
              styles.moreMenuButton,
              pressed && styles.headerFilterButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="여러 개 정리할게요"
            accessibilityHint="정리할 재료를 골라 한 번에 빼 둘 수 있어요."
          >
            <ListChecks
              color={colors.subtext}
              size={spacing.md}
              strokeWidth={2.4}
            />
          </Pressable>
        </View>

        <View
          style={[
            styles.filterPairRow,
            shouldStackDense && styles.filterPairRowDense,
          ]}
        >
          <View
            style={[
              styles.filterControls,
              shouldStackDense && styles.filterControlsDense,
            ]}
          >
            <View
              style={styles.expiryTrafficRow}
              testID="inventory-expiry-traffic"
            >
              <ExpiryTrafficLamp
                label="확인"
                count={facetCounts.status.unknown}
                tone="unknown"
                lampOn={
                  filter === "all"
                    ? facetCounts.status.unknown > 0
                    : filter === "unknown"
                }
                selected={filter === "unknown"}
                onPress={() => onToggleExpiryFilter("unknown")}
                testID="inventory-expiry-filter-unknown"
                accessibilityLabel={`기한 확인 ${facetCounts.status.unknown}건`}
                accessibilityHint={
                  filter === "unknown"
                    ? "다시 누르면 전체 보관함을 보여 드려요."
                    : "유통기한을 모르는 재료만 보여 드릴게요."
                }
              />
              <ExpiryTrafficLamp
                label="만료"
                count={facetCounts.status.expired}
                tone="danger"
                lampOn={
                  filter === "all"
                    ? facetCounts.status.expired > 0
                    : filter === "expired"
                }
                selected={filter === "expired"}
                onPress={() => onToggleExpiryFilter("expired")}
                testID="inventory-expiry-filter-expired"
                accessibilityLabel={`만료 ${facetCounts.status.expired}건`}
                accessibilityHint={
                  filter === "expired"
                    ? "다시 누르면 전체 보관함을 보여 드려요."
                    : "기한이 지난 재료만 보여 드릴게요."
                }
              />
              <ExpiryTrafficLamp
                label="곧"
                count={facetCounts.status.within7}
                tone="warning"
                lampOn={
                  filter === "all"
                    ? facetCounts.status.within7 > 0
                    : filter === "within7"
                }
                selected={filter === "within7"}
                onPress={() => onToggleExpiryFilter("within7")}
                testID="inventory-expiry-filter-within7"
                accessibilityLabel={`곧 ${facetCounts.status.within7}건`}
                accessibilityHint={
                  filter === "within7"
                    ? "다시 누르면 전체 보관함을 보여 드려요."
                    : "7일 안에 손볼 재료만 보여 드릴게요."
                }
              />
              <ExpiryTrafficLamp
                label="여유"
                count={facetCounts.status.safe}
                tone="success"
                lampOn={
                  filter === "all"
                    ? facetCounts.status.safe > 0
                    : filter === "safe"
                }
                selected={filter === "safe"}
                onPress={() => onToggleExpiryFilter("safe")}
                testID="inventory-expiry-filter-safe"
                accessibilityLabel={`여유 ${facetCounts.status.safe}건`}
                accessibilityHint={
                  filter === "safe"
                    ? "다시 누르면 전체 보관함을 보여 드려요."
                    : "아직 여유 있는 재료만 보여 드릴게요."
                }
              />
            </View>

            <View
              style={[
                styles.locationFilterTile,
                shouldStackDense && styles.locationFilterTileDense,
                hasLocationFilter && styles.locationFilterTileActive,
              ]}
            >
              <Pressable
                onPress={onOpenLocationFilter}
                accessibilityRole="button"
                accessibilityLabel={
                  hasLocationFilter
                    ? `${selectedLocationLabel} 위치 필터, 바꿀게요`
                    : "위치별로 볼게요"
                }
                accessibilityHint="냉장고·냉동실처럼 위치만 골라 볼 수 있어요."
                style={({ pressed }) => [
                  styles.locationFilterMain,
                  pressed && styles.filterControlPressed,
                ]}
              >
                <MapPin
                  color={hasLocationFilter ? colors.primary : colors.subtext}
                  size={spacing.sm}
                  strokeWidth={2.4}
                />
                <AppText
                  variant="bodySmall"
                  tone={hasLocationFilter ? "primary" : "default"}
                  numberOfLines={shouldStackDense ? undefined : 1}
                  style={styles.locationFilterTitle}
                >
                  {selectedLocationLabel}
                </AppText>
              </Pressable>
            </View>
          </View>
          <Pressable
            onPress={onClearFilters}
            disabled={!hasActiveFilters}
            style={({ pressed }) => [
              styles.moreMenuButton,
              pressed && hasActiveFilters && styles.headerFilterButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ disabled: !hasActiveFilters }}
            accessibilityLabel={
              hasActiveFilters
                ? "골라둔 조건을 풀어 볼게요"
                : "이미 전체 보관함을 보고 있어요"
            }
            accessibilityHint="검색어와 유통기한·위치 조건을 모두 풀어요."
          >
            <RefreshCw
              color={hasActiveFilters ? colors.subtext : colors.mutedText}
              size={spacing.md}
              strokeWidth={2.4}
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function InventorySelectionBar({
  embedded = false,
  selectedCount,
  visibleCount,
  expiredVisibleCount,
  onSelectAll,
  onSelectExpired,
  onCancel,
}: {
  embedded?: boolean;
  selectedCount: number;
  visibleCount: number;
  expiredVisibleCount: number;
  onSelectAll: () => void;
  onSelectExpired: () => void;
  onCancel: () => void;
}) {
  return (
    <View
      style={[
        styles.selectionRow,
        embedded && styles.selectionRowEmbedded,
      ]}
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
