import {
  calculateDaysLeftUntilExpiry,
  fieldLimits,
  getExpiryBucket,
  groupInventoryItems,
  ItemStatus,
  type InventoryItem,
  type InventoryItemGroup,
} from "@expirymate/shared";
import { router, useLocalSearchParams } from "expo-router";
import {
  CheckSquare,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import fridgeInteriorBg from "../../assets/backgrounds/fridge-interior-bg.png";
import { AppText } from "../../src/components/AppText";
import { BottomSheet } from "../../src/components/BottomSheet";
import { Button } from "../../src/components/Button";
import {
  HomeStatsSkeleton,
  InventoryListSkeleton,
} from "../../src/components/ContentSkeleton";
import { EmptyState } from "../../src/components/EmptyState";
import { FeedbackBanner } from "../../src/components/FeedbackBanner";
import { InventoryGroupCard } from "../../src/components/InventoryGroupCard";
import { Mascot, type MascotMood } from "../../src/components/Mascot";
import { Pill } from "../../src/components/Pill";
import { Screen } from "../../src/components/Screen";
import { StatCard } from "../../src/components/StatCard";
import {
  buildInventoryUrgencySections,
  filterInventoryItems,
  parseInventoryViewFilter,
  type InventoryViewFilter,
} from "../../src/features/inventory/filters";
import { useBatchDiscardInventoryItems } from "../../src/features/inventory/use-batch-discard-inventory-items";
import { useDeferredDiscardInventoryItem } from "../../src/features/inventory/use-deferred-discard-inventory-item";
import { useInventoryList } from "../../src/features/inventory/use-inventory-list";
import { getSettingsErrorMessage } from "../../src/features/settings/settings-format";
import { useStorageLocations } from "../../src/features/settings/use-storage-locations";
import { colors, radius, spacing, touchTarget, typography } from "../../src/shared/theme";
import { useRegistrationStore } from "../../src/store/registration-store";

export default function InventoryScreen() {
  const params = useLocalSearchParams<{ filter?: string | string[] }>();
  const filterParam = parseInventoryViewFilter(params.filter);
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useInventoryList();
  const batchDiscardMutation = useBatchDiscardInventoryItems();
  const deferredDiscard = useDeferredDiscardInventoryItem();
  const clearPrefill = useRegistrationStore((state) => state.clearPrefill);
  const {
    selectableOptions,
    resolveLabel,
    createMutation,
  } = useStorageLocations();
  const [filter, setFilter] = useState<InventoryViewFilter>(
    () => filterParam ?? "all",
  );
  const [location, setLocation] = useState<string | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [addLocationVisible, setAddLocationVisible] = useState(false);
  const [newLocationLabel, setNewLocationLabel] = useState("");
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (filterParam) {
      setFilter(filterParam);
    }
  }, [filterParam]);

  useEffect(() => {
    const keys = new Set(selectableOptions.map((option) => option.key));

    if (location !== "all" && !keys.has(location)) {
      setLocation("all");
    }
  }, [location, selectableOptions]);

  const applyFilter = (nextFilter: InventoryViewFilter) => {
    setFilter(nextFilter);
    router.setParams({
      filter: nextFilter === "all" ? undefined : nextFilter,
    });
  };

  const toggleTrafficFilter = (nextFilter: InventoryViewFilter) => {
    applyFilter(filter === nextFilter ? "all" : nextFilter);
  };

  const hasLoadedInventory = data !== undefined;
  const loadErrorMessage =
    error instanceof Error
      ? error.message
      : "앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?";

  const activeItems = useMemo(
    () => (data ?? []).filter((item) => item.status === ItemStatus.ACTIVE),
    [data],
  );
  const activeGroups = useMemo(
    () => groupInventoryItems(activeItems),
    [activeItems],
  );

  const filtered = useMemo(
    () => filterInventoryItems(activeItems, filter, location, searchQuery),
    [activeItems, filter, location, searchQuery],
  );
  const filteredGroups = useMemo(
    () => groupInventoryItems(filtered),
    [filtered],
  );
  const listSections = useMemo(() => {
    const sections = buildInventoryUrgencySections(filteredGroups);
    const titled =
      filter !== "expired"
        ? sections
        : sections.map((section) =>
            section.key === "today"
              ? { ...section, title: "만료됐어요" }
              : section,
          );

    // One SectionList item per urgency bucket so title + groups share a card.
    return titled.map((section) => ({
      key: section.key,
      title: section.title,
      data: [
        {
          id: section.key,
          title: section.title,
          groups: section.data,
        } satisfies InventoryUrgencySectionCard,
      ],
    }));
  }, [filteredGroups, filter]);
  const visibleIds = useMemo(() => filtered.map((item) => item.id), [filtered]);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIdSet.has(id));
  const locationCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    selectableOptions.forEach((option) => {
      counts[option.key] = groupInventoryItems(
        activeItems.filter((item) => item.storageLocation === option.key),
      ).length;
    });

    return counts;
  }, [activeItems, selectableOptions]);

  const hasLocationFilter = location !== "all";
  const hasSearchQuery = searchQuery.trim().length > 0;
  const hasStatusFilter = filter !== "all";
  const showFilterChips = hasStatusFilter;
  const statusFilterLabel =
    filter === "today"
      ? "오늘 만료"
      : filter === "within7"
        ? "7일 이내"
        : filter === "expired"
          ? "만료"
          : null;
  const statusFilterTone =
    filter === "within7" ? ("warning" as const) : ("danger" as const);
  const activeLocationLabel = hasLocationFilter
    ? resolveLabel(location)
    : null;
  const trafficStats = useMemo(() => {
    let todayExpiryCount = 0;
    let within7DaysCount = 0;

    activeGroups.forEach((group) => {
      const bucket = getExpiryBucket(group.nearestExpiryDate);
      const daysLeft = calculateDaysLeftUntilExpiry(group.nearestExpiryDate);

      if (bucket === "today") {
        todayExpiryCount += 1;
      }

      if (daysLeft >= 0 && daysLeft <= 7) {
        within7DaysCount += 1;
      }
    });

    return {
      todayExpiryCount,
      within7DaysCount,
      totalActiveCount: activeGroups.length,
    };
  }, [activeGroups]);

  const companion = useMemo(() => {
    if (deferredDiscard.undoLabel || successMessage) {
      return {
        mood: "happy" as MascotMood,
        title: "잘 정리하고 있어요",
        description: "장고도 한숨 돌렸어요.",
      };
    }

    if (trafficStats.todayExpiryCount > 0) {
      return {
        mood: "worry" as MascotMood,
        title: "오늘 손볼 재료가 있어요",
        description: "유통기한이 가까운 것부터 살펴볼까요?",
      };
    }

    if (
      trafficStats.totalActiveCount > 0 &&
      trafficStats.within7DaysCount === 0
    ) {
      return {
        mood: "happy" as MascotMood,
        title: "지금은 여유로워요",
        description: "냉장고가 한산해서 장고도 편해요.",
      };
    }

    return null;
  }, [
    deferredDiscard.undoLabel,
    successMessage,
    trafficStats.todayExpiryCount,
    trafficStats.totalActiveCount,
    trafficStats.within7DaysCount,
  ]);

  const selectCompartment = (next: string | "all") => {
    setLocation((current) =>
      next !== "all" && current === next ? "all" : next,
    );
  };

  const handleCreateLocation = () => {
    createMutation.mutate(
      { label: newLocationLabel },
      {
        onSuccess: (created) => {
          setAddLocationVisible(false);
          setNewLocationLabel("");
          setLocation(created.key);
          Alert.alert("위치를 만들었어요", "이제 이 위치만 볼 수 있어요.");
        },
        onError: (error) =>
          Alert.alert("앗, 잠시 문제가 생겼어요", getSettingsErrorMessage(error)),
      },
    );
  };

  // Only treat as empty after a successful load — never during loading/error.
  const isEmptyInventory =
    hasLoadedInventory && !isError && activeItems.length === 0;
  const isFilteredEmpty = !isEmptyInventory && filtered.length === 0;
  const showListChrome = hasLoadedInventory && !isError && !isEmptyInventory;
  const soloGroupId =
    filteredGroups.length === 1 ? filteredGroups[0]?.id ?? null : null;

  useEffect(() => {
    const visibleIdSet = new Set(visibleIds);

    setSelectedIds((current) => {
      const nextIds = current.filter((id) => visibleIdSet.has(id));

      return nextIds.length === current.length ? current : nextIds;
    });
  }, [visibleIds]);

  // Single matching group: open lots by default so the next action is obvious.
  useEffect(() => {
    if (!soloGroupId) {
      return;
    }

    setExpandedGroupIds((current) =>
      current.includes(soloGroupId) ? current : [...current, soloGroupId],
    );
  }, [soloGroupId, filter, location, searchQuery]);

  const goToRegister = () => {
    clearPrefill();
    router.push("/register");
  };

  const clearListFilters = () => {
    if (filter !== "all") {
      applyFilter("all");
    }
    if (hasLocationFilter) {
      setLocation("all");
    }
    if (hasSearchQuery) {
      setSearchQuery("");
    }
  };

  const enterSelectionMode = (initialId?: string) => {
    setIsSelectionMode(true);
    setSuccessMessage(null);
    setActionErrorMessage(null);
    deferredDiscard.clearError();
    setSelectedIds(initialId ? [initialId] : []);
  };

  const cancelSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedIds([]);
    setActionErrorMessage(null);
  };

  const toggleSelectedId = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id],
    );
  };

  const handleToggleAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((current) =>
        current.filter((id) => !visibleIds.includes(id)),
      );
      return;
    }

    setSelectedIds((current) => [...new Set([...current, ...visibleIds])]);
  };

  const handleCardPress = (id: string) => {
    if (isSelectionMode) {
      toggleSelectedId(id);
      return;
    }

    router.push({
      pathname: "/inventory/[id]",
      params: { id },
    });
  };

  const handleCardLongPress = (id: string) => {
    enterSelectionMode(id);
  };

  const setGroupExpanded = (groupId: string, expanded: boolean) => {
    setExpandedGroupIds((current) =>
      expanded
        ? [...new Set([...current, groupId])]
        : current.filter((id) => id !== groupId),
    );
  };

  const handleConfirmBatchDiscard = () => {
    if (!selectedIds.length) {
      return;
    }

    Alert.alert(
      "이 재료들을 정리할까요?",
      "정리하면 보관함 목록에서 사라져요. 장고가 기억해 둘게요.",
      [
        { text: "조금만 더 둘래요", style: "cancel" },
        {
          text: "정리할게요",
          style: "destructive",
          onPress: async () => {
            try {
              setActionErrorMessage(null);
              deferredDiscard.clearError();
              const result = await batchDiscardMutation.mutateAsync(selectedIds);
              setSuccessMessage(
                `${result.count}개 재료를 정리했어요. 장고도 한숨 돌렸어요.`,
              );
              setSelectedIds([]);
              setIsSelectionMode(false);
            } catch (error) {
              setActionErrorMessage(
                error instanceof Error
                  ? error.message
                  : "앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?",
              );
            }
          },
        },
      ],
    );
  };

  const handleDiscard = (item: InventoryItem) => {
    setSuccessMessage(null);
    setActionErrorMessage(null);
    void deferredDiscard.scheduleDiscard(item);
  };

  return (
    <Screen
      scroll={false}
      footer={
        !showListChrome || isFilteredEmpty
          ? null
          : isSelectionMode
            ? (
              <Button
                variant="danger"
                icon={Trash2}
                onPress={handleConfirmBatchDiscard}
                loading={batchDiscardMutation.isPending}
                disabled={!selectedIds.length}
                fullWidth
              >
                {selectedIds.length
                  ? `${selectedIds.length}개 정리할게요`
                  : "정리할 재료를 골라 주세요"}
              </Button>
            )
            : (
              <Button icon={Plus} onPress={goToRegister} fullWidth>
                재료 넣으러 가기
              </Button>
            )
      }
      contentStyle={styles.screenContent}
    >
      <View style={styles.fridgeScene}>
        <ImageBackground
          source={fridgeInteriorBg}
          style={styles.fridgeSceneBackground}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
          importantForAccessibility="no"
        />
        {/* Soft wash so white inventory cards stay readable on the fridge cavity. */}
        <View
          pointerEvents="none"
          style={styles.fridgeSceneVeil}
          importantForAccessibility="no-hide-descendants"
        />
        <SectionList
          style={styles.listFlex}
          sections={
            isLoading && !hasLoadedInventory
              ? []
              : isError && !hasLoadedInventory
                ? []
                : isEmptyInventory || isFilteredEmpty
                  ? []
                  : listSections
          }
          keyExtractor={(card) => card.id}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              tintColor={colors.primary}
              refreshing={isRefetching}
              onRefresh={() => {
                void refetch();
              }}
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          removeClippedSubviews
          ListHeaderComponent={
            <View style={styles.listHeader}>
            {isLoading && !hasLoadedInventory ? (
              <HomeStatsSkeleton />
            ) : showListChrome && !isSelectionMode ? (
              <View style={styles.chromeStack}>
                <View style={styles.trafficGroup}>
                  <View
                    style={styles.trafficStrip}
                    accessibilityRole="summary"
                    accessibilityLabel={`오늘 만료 ${trafficStats.todayExpiryCount}개, 7일 이내 ${trafficStats.within7DaysCount}개, 보관 중 ${trafficStats.totalActiveCount}개`}
                  >
                    <Pressable
                      style={styles.trafficLampPressable}
                      onPress={() => toggleTrafficFilter("today")}
                      accessibilityRole="button"
                      accessibilityState={{ selected: filter === "today" }}
                      accessibilityLabel={`오늘 만료 ${trafficStats.todayExpiryCount}개`}
                      accessibilityHint={
                        filter === "today"
                          ? "다시 누르면 전체 목록으로 돌아가요."
                          : "오늘 만료되는 재료만 보여 드릴게요."
                      }
                    >
                      <StatCard
                        variant="traffic"
                        label="오늘 만료"
                        value={trafficStats.todayExpiryCount}
                        tone="danger"
                        showLabel={false}
                        selected={filter === "today"}
                      />
                    </Pressable>
                    <Pressable
                      style={styles.trafficLampPressable}
                      onPress={() => toggleTrafficFilter("within7")}
                      accessibilityRole="button"
                      accessibilityState={{ selected: filter === "within7" }}
                      accessibilityLabel={`7일 이내 ${trafficStats.within7DaysCount}개`}
                      accessibilityHint={
                        filter === "within7"
                          ? "다시 누르면 전체 목록으로 돌아가요."
                          : "7일 안에 손볼 재료만 보여 드릴게요."
                      }
                    >
                      <StatCard
                        variant="traffic"
                        label="7일 이내"
                        value={trafficStats.within7DaysCount}
                        tone="warning"
                        showLabel={false}
                        selected={filter === "within7"}
                      />
                    </Pressable>
                    <Pressable
                      style={styles.trafficLampPressable}
                      onPress={() => applyFilter("all")}
                      accessibilityRole="button"
                      accessibilityState={{ selected: filter === "all" }}
                      accessibilityLabel={`보관 중 ${trafficStats.totalActiveCount}개`}
                      accessibilityHint="전체 보관 재료를 보여 드릴게요."
                    >
                      <StatCard
                        variant="traffic"
                        label="보관 중"
                        value={trafficStats.totalActiveCount}
                        tone="success"
                        showLabel={false}
                        selected={filter === "all"}
                      />
                    </Pressable>
                  </View>
                  <View
                    style={styles.trafficLabels}
                    importantForAccessibility="no-hide-descendants"
                  >
                    <AppText
                      variant="caption"
                      tone="subtext"
                      style={styles.trafficLabel}
                    >
                      오늘 만료
                    </AppText>
                    <AppText
                      variant="caption"
                      tone="subtext"
                      style={styles.trafficLabel}
                    >
                      7일 이내
                    </AppText>
                    <AppText
                      variant="caption"
                      tone="subtext"
                      style={styles.trafficLabel}
                    >
                      보관 중
                    </AppText>
                  </View>
                </View>

                {companion ? (
                  <View
                    style={styles.companionCard}
                    accessibilityRole="summary"
                    accessibilityLabel={`${companion.title}. ${companion.description}`}
                  >
                    <Mascot size="small" mood={companion.mood} />
                    <View style={styles.companionCopy}>
                      <Text style={styles.companionTitle}>{companion.title}</Text>
                      <Text style={styles.companionDescription}>
                        {companion.description}
                      </Text>
                    </View>
                  </View>
                ) : null}

                <View style={styles.findBlock}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.compartmentRail}
                  >
                    <Pressable
                      onPress={() => selectCompartment("all")}
                      accessibilityRole="button"
                      accessibilityState={{ selected: location === "all" }}
                      accessibilityLabel={`전체 위치, ${activeGroups.length}개`}
                      style={({ pressed }) => [
                        styles.compartmentChip,
                        location === "all" && styles.compartmentChipSelected,
                        pressed && styles.headerFilterButtonPressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.compartmentChipLabel,
                          location === "all" &&
                            styles.compartmentChipLabelSelected,
                        ]}
                      >
                        전체
                      </Text>
                      <Text
                        style={[
                          styles.compartmentChipCount,
                          location === "all" &&
                            styles.compartmentChipCountSelected,
                        ]}
                      >
                        {activeGroups.length}
                      </Text>
                    </Pressable>
                    {selectableOptions.map((option) => {
                      const selected = location === option.key;
                      const count = locationCounts[option.key] ?? 0;

                      return (
                        <Pressable
                          key={option.key}
                          onPress={() => selectCompartment(option.key)}
                          onLongPress={() => {
                            if (!option.readonly) {
                              router.push("/settings/storage-locations");
                            }
                          }}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          accessibilityLabel={`${option.label}, ${count}개`}
                          accessibilityHint={
                            selected
                              ? "다시 누르면 전체 위치로 돌아가요."
                              : `${option.label}만 보여 드릴게요.`
                          }
                          style={({ pressed }) => [
                            styles.compartmentChip,
                            selected && styles.compartmentChipSelected,
                            pressed && styles.headerFilterButtonPressed,
                          ]}
                        >
                          <Text
                            style={[
                              styles.compartmentChipLabel,
                              selected && styles.compartmentChipLabelSelected,
                            ]}
                          >
                            {option.label}
                          </Text>
                          <Text
                            style={[
                              styles.compartmentChipCount,
                              selected && styles.compartmentChipCountSelected,
                            ]}
                          >
                            {count}
                          </Text>
                        </Pressable>
                      );
                    })}
                    <Pressable
                      onPress={() => {
                        setNewLocationLabel("");
                        setAddLocationVisible(true);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="위치 추가"
                      accessibilityHint="나만의 보관 위치를 만들어요."
                      style={({ pressed }) => [
                        styles.compartmentChip,
                        styles.compartmentChipAdd,
                        pressed && styles.headerFilterButtonPressed,
                      ]}
                    >
                      <Plus
                        color={colors.primary}
                        size={spacing.sm}
                        strokeWidth={2.4}
                      />
                      <Text style={styles.compartmentChipAddLabel}>위치 추가</Text>
                    </Pressable>
                  </ScrollView>
                  {hasLocationFilter ? (
                    <View style={styles.shelfCaption}>
                      <View style={styles.shelfRail} />
                      <Text style={styles.shelfCaptionText}>
                        {activeLocationLabel}만 보고 있어요
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.searchRow}>
                    <View style={styles.searchField}>
                      <Search
                        color={colors.mutedText}
                        size={spacing.md}
                        strokeWidth={2.4}
                      />
                      <TextInput
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="재료 이름 찾아볼게요"
                        placeholderTextColor={colors.mutedText}
                        accessibilityLabel="재료 이름 검색"
                        returnKeyType="search"
                        autoCorrect={false}
                        autoCapitalize="none"
                        style={styles.searchInput}
                      />
                      {hasSearchQuery ? (
                        <Pressable
                          onPress={() => setSearchQuery("")}
                          hitSlop={spacing.xs}
                          accessibilityRole="button"
                          accessibilityLabel="검색어 지우기"
                          style={({ pressed }) => [
                            styles.searchClearButton,
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
                      onPress={() => enterSelectionMode()}
                      hitSlop={spacing.xs}
                      style={({ pressed }) => [
                        styles.headerIconButton,
                        pressed && styles.headerFilterButtonPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="고르기"
                      accessibilityHint="여러 재료를 골라 한 번에 정리할 수 있어요."
                    >
                      <CheckSquare
                        color={colors.primary}
                        size={spacing.md}
                        strokeWidth={2.4}
                      />
                    </Pressable>
                  </View>
                  {showFilterChips && statusFilterLabel ? (
                    <View style={styles.chipRow}>
                      <Pill
                        label={statusFilterLabel}
                        icon={X}
                        selected
                        tone={statusFilterTone}
                        onPress={() => applyFilter("all")}
                        accessibilityLabel={`${statusFilterLabel} 필터 끌게요`}
                      />
                    </View>
                  ) : null}
                </View>
              </View>
            ) : showListChrome && isSelectionMode ? (
              <View
                style={styles.selectionRow}
                accessibilityLiveRegion="polite"
                accessibilityLabel={
                  selectedIds.length
                    ? `${selectedIds.length}개 골랐어요`
                    : "고르기 모드예요. 정리할 재료를 눌러 주세요."
                }
              >
                <View style={styles.selectionSummary}>
                  <Text style={styles.selectionTitle} numberOfLines={1}>
                    {selectedIds.length
                      ? `${selectedIds.length}개 골랐어요`
                      : "정리할 재료를 눌러 주세요"}
                  </Text>
                </View>
                <View style={styles.headerActions}>
                  <Pressable
                    onPress={handleToggleAllVisible}
                    disabled={!visibleIds.length}
                    hitSlop={spacing.xs}
                    accessibilityRole="button"
                    accessibilityLabel={
                      allVisibleSelected ? "전부 해제" : "전부 고르기"
                    }
                    style={({ pressed }) => [
                      styles.headerFilterButton,
                      pressed && styles.headerFilterButtonPressed,
                    ]}
                  >
                    <Text style={styles.headerFilterLabel}>
                      {allVisibleSelected ? "전부 해제" : "전부 고르기"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={cancelSelectionMode}
                    hitSlop={spacing.xs}
                    style={({ pressed }) => [
                      styles.headerFilterButton,
                      pressed && styles.headerFilterButtonPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="고르기 그만두기"
                  >
                    <Text style={styles.headerFilterLabel}>그만두기</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {deferredDiscard.undoLabel ? (
              <FeedbackBanner
                tone="success"
                title={deferredDiscard.undoLabel}
                description="잘못 눌렀다면 바로 되돌릴 수 있어요."
                actionLabel="되돌릴게요"
                onAction={deferredDiscard.undoDiscard}
              />
            ) : successMessage ? (
              <FeedbackBanner tone="success" title={successMessage} />
            ) : null}

            {deferredDiscard.errorMessage || actionErrorMessage ? (
              <FeedbackBanner
                tone="danger"
                title="앗, 잠시 문제가 생겼어요"
                description={
                  deferredDiscard.errorMessage ?? actionErrorMessage ?? undefined
                }
              />
            ) : null}

            {isError && hasLoadedInventory ? (
              <FeedbackBanner
                tone="danger"
                title="앗, 보관함을 불러오지 못했어요"
                description={loadErrorMessage}
                actionLabel="다시 불러올게요"
                onAction={() => {
                  void refetch();
                }}
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          isLoading && !hasLoadedInventory ? (
            <InventoryListSkeleton />
          ) : isError && !hasLoadedInventory ? (
            <EmptyState
              mood="worry"
              title="앗, 보관함을 불러오지 못했어요"
              description={loadErrorMessage}
              actionLabel="다시 불러올게요"
              onAction={() => {
                void refetch();
              }}
            />
          ) : isEmptyInventory ? (
            <EmptyState
              mood="empty"
              title="아직 넣어둔 재료가 없어요"
              description="장고가 빈 냉장고를 바라보고 있어요. 첫 재료를 넣으러 가볼까요?"
              actionLabel="재료 넣으러 가기"
              onAction={goToRegister}
            />
          ) : isFilteredEmpty ? (
            <EmptyState
              mood={
                hasSearchQuery ? "idle" : getFilteredEmptyMood(filter)
              }
              title={getFilteredEmptyTitle(filter, hasSearchQuery)}
              description={getFilteredEmptyDescription(
                filter,
                hasLocationFilter,
                hasSearchQuery,
              )}
              actionLabel={
                hasSearchQuery && !hasStatusFilter && !hasLocationFilter
                  ? "검색어 지울게요"
                  : filter === "all" && hasLocationFilter && !hasSearchQuery
                    ? "모든 위치 볼게요"
                    : "전체 보관함 볼게요"
              }
              onAction={
                hasSearchQuery && !hasStatusFilter && !hasLocationFilter
                  ? () => setSearchQuery("")
                  : clearListFilters
              }
              accessory={
                <Button
                  variant="secondary"
                  onPress={goToRegister}
                  fullWidth
                >
                  재료 넣으러 가기
                </Button>
              }
            />
          ) : null
        }
        renderItem={({ item: card }) => (
          <View
            style={styles.urgencySectionCard}
            accessibilityRole="summary"
            accessibilityLabel={`${card.title}, ${card.groups.length}개`}
          >
            <View style={styles.urgencySectionHeader}>
              <Text style={styles.sectionTitle}>{card.title}</Text>
              <Text style={styles.sectionCount}>{card.groups.length}개</Text>
            </View>
            <View style={styles.urgencySectionList}>
              {card.groups.map((group) => (
                <InventoryGroupCard
                  key={group.id}
                  group={group}
                  expanded={expandedGroupIds.includes(group.id)}
                  onExpandedChange={(expanded) =>
                    setGroupExpanded(group.id, expanded)
                  }
                  selectionMode={isSelectionMode}
                  selectedIds={selectedIdSet}
                  isDiscarding={deferredDiscard.isPending}
                  resolveLocationLabel={resolveLabel}
                  onItemPress={(item) => handleCardPress(item.id)}
                  onItemLongPress={(item) => handleCardLongPress(item.id)}
                  onItemDiscard={handleDiscard}
                />
              ))}
            </View>
          </View>
        )}
        SectionSeparatorComponent={() => (
          <View style={styles.sectionSeparator} />
        )}
      />
      </View>

      <BottomSheet
        visible={addLocationVisible}
        onClose={() => setAddLocationVisible(false)}
        title="어디에 둘까요?"
        description="위치 이름을 알려 주시면 목록에 넣어 둘게요."
        mascotMood="idle"
        footer={
          <Button
            onPress={handleCreateLocation}
            loading={createMutation.isPending}
            disabled={newLocationLabel.trim().length === 0}
            fullWidth
          >
            여기에 보관할까요?
          </Button>
        }
      >
        <View style={styles.addLocationField}>
          <Text style={styles.addLocationLabel}>위치 이름</Text>
          <TextInput
            value={newLocationLabel}
            onChangeText={setNewLocationLabel}
            placeholder="예: 팬트리"
            placeholderTextColor={colors.mutedText}
            maxLength={fieldLimits.storageLocationLabel}
            autoFocus
            style={styles.addLocationInput}
          />
        </View>
      </BottomSheet>
    </Screen>
  );
}

function getFilteredEmptyMood(filter: InventoryViewFilter) {
  if (filter === "today" || filter === "within7") {
    return "happy" as const;
  }

  return "idle" as const;
}

type InventoryUrgencySectionCard = {
  id: string;
  title: string;
  groups: InventoryItemGroup[];
};

function getFilteredEmptyTitle(
  filter: InventoryViewFilter,
  hasSearchQuery: boolean,
) {
  if (hasSearchQuery) {
    return "찾는 재료가 없어요";
  }

  if (filter === "today") {
    return "오늘 만료가 없어요";
  }

  if (filter === "within7") {
    return "7일 안에 손볼 재료가 없어요";
  }

  if (filter === "expired") {
    return "만료된 재료가 없어요";
  }

  return "이 위치에는 재료가 없어요";
}

function getFilteredEmptyDescription(
  filter: InventoryViewFilter,
  hasLocationFilter: boolean,
  hasSearchQuery: boolean,
) {
  if (hasSearchQuery) {
    return hasLocationFilter || filter !== "all"
      ? "검색어를 지우거나 필터를 넓혀 볼까요?"
      : "다른 이름으로 찾아보거나, 새 재료를 넣어볼까요?";
  }

  if (filter === "today") {
    return hasLocationFilter
      ? "위치를 바꾸거나 전체 보관함을 둘러볼까요?"
      : "오늘은 여유롭네요. 전체 목록을 둘러보거나 새 재료를 넣어볼까요?";
  }

  if (filter === "within7") {
    return hasLocationFilter
      ? "위치를 바꾸거나 전체 보관함을 둘러볼까요?"
      : "급한 재료가 없어요. 전체 목록을 보거나 재료를 더 넣어볼까요?";
  }

  if (hasLocationFilter) {
    return "다른 위치를 고르거나, 새 재료를 넣어볼까요?";
  }

  return "조건을 조금 넓히거나, 새 재료를 넣어볼까요?";
}

const styles = StyleSheet.create({
  chromeStack: {
    gap: spacing.md,
  },
  trafficGroup: {
    gap: spacing.xs,
  },
  trafficStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.text,
  },
  trafficLampPressable: {
    flex: 1,
    alignItems: "center",
    minHeight: touchTarget.min,
    justifyContent: "center",
  },
  trafficLabels: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  trafficLabel: {
    flex: 1,
    textAlign: "center",
  },
  findBlock: {
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  companionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  companionCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  companionTitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.text,
  },
  companionDescription: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.subtext,
  },
  compartmentRail: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  compartmentChip: {
    minHeight: touchTarget.min,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  compartmentChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  compartmentChipLabel: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  compartmentChipLabelSelected: {
    color: colors.primary,
  },
  compartmentChipCount: {
    minWidth: spacing.md,
    overflow: "hidden",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    textAlign: "center",
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.subtext,
    backgroundColor: colors.mutedSurface,
  },
  compartmentChipCountSelected: {
    color: colors.primary,
    backgroundColor: colors.surface,
  },
  compartmentChipAdd: {
    borderStyle: "dashed",
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  compartmentChipAddLabel: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.primary,
  },
  addLocationField: {
    gap: spacing.xs,
  },
  addLocationLabel: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.text,
  },
  addLocationInput: {
    minHeight: touchTarget.cta,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.body.fontFamily,
  },
  shelfCaption: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xxs,
  },
  shelfRail: {
    width: spacing.xs,
    height: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  shelfCaptionText: {
    flex: 1,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.subtext,
  },
  searchRow: {
    minHeight: touchTarget.min,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  searchField: {
    flex: 1,
    minWidth: 0,
    minHeight: touchTarget.min,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingLeft: spacing.sm,
    paddingRight: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: touchTarget.min,
    paddingVertical: spacing.sm,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.body.fontFamily,
    color: colors.text,
  },
  searchClearButton: {
    width: touchTarget.icon,
    height: touchTarget.icon,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    gap: spacing.xxs,
  },
  headerIconButton: {
    width: touchTarget.icon,
    height: touchTarget.icon,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
  },
  headerFilterButton: {
    minHeight: touchTarget.min,
    minWidth: touchTarget.icon,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xxs,
    borderRadius: radius.lg,
  },
  headerFilterButtonPressed: {
    backgroundColor: colors.surfacePressed,
  },
  headerFilterLabel: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.primary,
  },
  selectionRow: {
    minHeight: touchTarget.min,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selectionSummary: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    minHeight: touchTarget.min,
  },
  selectionTitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.text,
  },
  screenContent: {
    flex: 1,
    gap: spacing.none,
    // Bleed fridge scene to Screen edges; list keeps the 24px inset itself.
    paddingHorizontal: spacing.none,
    paddingTop: spacing.none,
    paddingBottom: spacing.none,
  },
  fridgeScene: {
    flex: 1,
    overflow: "hidden",
  },
  fridgeSceneBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  fridgeSceneVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    opacity: 0.24,
  },
  listFlex: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl + spacing.sm,
  },
  listHeader: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  urgencySectionCard: {
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  urgencySectionHeader: {
    minHeight: touchTarget.min,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingHorizontal: spacing.xxs,
  },
  urgencySectionList: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.subheading.fontSize,
    lineHeight: typography.subheading.lineHeight,
    fontFamily: typography.subheading.fontFamily,
    color: colors.text,
  },
  sectionCount: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.mutedText,
  },
  sectionSeparator: {
    height: spacing.xl,
  },
});
