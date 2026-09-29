import {
  type InventoryActivity,
  type InventoryActivitySnapshot,
  formatDateKoreanCompact,
  resolveStorageLocationLabel,
  unitCodeLabels,
  UnitCode,
  type UserStorageLocation,
} from "@expirymate/shared";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { AppText } from "../../src/components/AppText";
import { Button } from "../../src/components/Button";
import { EmptyState } from "../../src/components/EmptyState";
import { FeedbackBanner } from "../../src/components/FeedbackBanner";
import { Screen } from "../../src/components/Screen";
import {
  sessionQueryKeys,
  withInventorySpace,
} from "../../src/features/auth/session-boundary";
import { useAuth } from "../../src/features/auth/use-auth";
import { useActiveSpace } from "../../src/features/spaces/space-provider";
import { getInventoryActivity, listStorageLocations } from "../../src/services/api";
import { colors, radius, spacing } from "../../src/shared/theme";

const actions: Record<InventoryActivity["action"], string> = {
  created: "등록",
  updated: "수정",
  consumed: "사용",
  discarded: "폐기",
};
const fields: Array<[keyof InventoryActivitySnapshot, string]> = [
  ["displayName", "이름"],
  ["quantityBase", "남은 양"],
  ["unitCode", "단위"],
  ["storageLocation", "보관 위치"],
  ["expiryDate", "유통기한"],
  ["openedDate", "개봉일"],
  ["openedCheckDate", "개봉 후 확인일"],
];
function displayValue(
  snapshot: InventoryActivitySnapshot,
  key: keyof InventoryActivitySnapshot,
  locations: UserStorageLocation[] = [],
) {
  const value = snapshot[key];
  if (key === "quantityBase")
    return `${value} ${unitCodeLabels[snapshot.unitCode as UnitCode] ?? snapshot.unitCode}`;
  if (key === "unitCode")
    return unitCodeLabels[snapshot.unitCode as UnitCode] ?? snapshot.unitCode;
  if (key === "storageLocation") {
    const label = resolveStorageLocationLabel(String(value), locations);
    return label === value ? "사용자 보관 위치" : label;
  }
  if (key.endsWith("Date"))
    return value ? formatDateKoreanCompact(String(value)) : "없음";
  return String(value ?? "없음");
}
export default function InventoryActivityScreen() {
  const params = useLocalSearchParams<{
    spaceId?: string;
    inventoryItemId?: string;
  }>();
  const { activeSpaceId } = useActiveSpace();
  const { sessionUserId } = useAuth();
  const spaceId =
    typeof params.spaceId === "string" ? params.spaceId : activeSpaceId;
  const itemId =
    typeof params.inventoryItemId === "string"
      ? params.inventoryItemId
      : undefined;
  const locationsQuery = useQuery({
    queryKey: withInventorySpace(sessionQueryKeys.storageLocations, sessionUserId, spaceId),
    enabled: Boolean(spaceId && sessionUserId),
    queryFn: () => {
      if (!spaceId) throw new Error("냉장고를 먼저 골라 주세요.");
      return listStorageLocations(spaceId);
    },
  });
  const query = useInfiniteQuery({
    queryKey: [
      ...withInventorySpace(
        sessionQueryKeys.inventoryActivity,
        sessionUserId,
        spaceId,
      ),
      itemId ?? "all",
    ],
    enabled: Boolean(spaceId && sessionUserId),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      if (!spaceId) throw new Error("냉장고를 먼저 골라 주세요.");
      return getInventoryActivity(spaceId, pageParam, itemId);
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      if (spaceId && sessionUserId) void refetch();
    }, [spaceId, sessionUserId, refetch]),
  );
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <Screen
      scroll
      topInsetMode="none"
      density="compact"
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching}
          onRefresh={() => void refetch()}
        />
      }
    >
      <Stack.Screen
        options={{ title: itemId ? "재료 변경 내역" : "냉장고 변경 내역" }}
      />
      <AppText variant="caption" tone="muted">
        기능 적용 이후의 등록·수정·사용·폐기를 최신순으로 보여 드려요. 이전
        내역은 소급하지 않아요.
      </AppText>
      {query.isError ? (
        <FeedbackBanner
          tone="danger"
          title="변경 내역을 불러오지 못했어요"
          description="냉장고에 참여 중인지와 연결 상태를 확인해 주세요."
          actionLabel="다시 시도"
          onAction={() => void refetch()}
        />
      ) : query.isPending ? (
        <AppText>변경 내역을 불러오고 있어요.</AppText>
      ) : !items.length ? (
        <EmptyState
          kind="empty"
          title="아직 변경 내역이 없어요"
          description="재료를 등록하거나 바꾸면 여기에 기록돼요."
        />
      ) : (
        items.map((item) => (
          <View key={item.id} style={styles.card}>
            <AppText variant="bodyStrong">
              {item.after.displayName} · {actions[item.action]}
            </AppText>
            <AppText variant="caption" tone="muted">
              {item.actorName} ·{" "}
              {new Date(item.createdAt).toLocaleString("ko-KR", {
                timeZone: "Asia/Seoul",
              })}
            </AppText>
            {item.before ? (
              fields
                .filter(([key]) => item.before?.[key] !== item.after[key])
                .map(([key, label]) => (
                  <AppText key={key} variant="bodySmall">
                    {label}: {displayValue(item.before!, key, locationsQuery.data?.custom)} →{" "}
                    {displayValue(item.after, key, locationsQuery.data?.custom)}
                  </AppText>
                ))
            ) : (
              <AppText variant="bodySmall">
                {displayValue(item.after, "quantityBase")} 등록
              </AppText>
            )}
          </View>
        ))
      )}
      {!query.isError && query.hasNextPage ? (
        <Button
          variant="secondary"
          loading={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        >
          이전 내역 더 보기
        </Button>
      ) : null}
    </Screen>
  );
}
const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
});
