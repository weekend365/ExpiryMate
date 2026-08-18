import { useMutation } from "@tanstack/react-query";
import { Search } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppText } from "../src/components/AppText";
import { AppTextInput } from "../src/components/AppTextInput";
import { Button } from "../src/components/Button";
import { Screen } from "../src/components/Screen";
import { AffiliateProductGroupView } from "../src/features/affiliate/affiliate-product-group";
import { useAffiliateShopping } from "../src/features/affiliate/use-affiliate-shopping";
import { useActiveSpace } from "../src/features/spaces/space-provider";
import {
  searchAffiliateProducts,
  trackMonetizationEvent,
} from "../src/services/api";
import { colors, radius, spacing } from "../src/shared/theme";

export default function ShoppingScreen() {
  const { activeSpaceId } = useActiveSpace();
  const shoppingQuery = useAffiliateShopping();
  const [query, setQuery] = useState("");
  const trackedOpened = useRef(false);
  const searchMutation = useMutation({
    mutationFn: async (value: string) => {
      if (!activeSpaceId) throw new Error("냉장고를 먼저 골라 주세요.");
      return searchAffiliateProducts(
        { query: value, placement: "shopping_search" },
        activeSpaceId,
      );
    },
  });

  useEffect(() => {
    if (trackedOpened.current) return;
    trackedOpened.current = true;
    void trackMonetizationEvent({
      event: "affiliate_shopping_opened",
      properties: { source: "home_or_context" },
    }).catch(() => undefined);
  }, []);

  const submitSearch = () => {
    const trimmed = query.trim();
    if (!trimmed || searchMutation.isPending) return;
    searchMutation.reset();
    searchMutation.mutate(trimmed);
  };
  const shopping = shoppingQuery.data;
  const searchGroup = searchMutation.data?.group ?? null;

  return (
    <Screen
      density="compact"
      title="장보기"
      subtitle="필요한 식재료를 쿠팡에서 바로 찾아보세요."
      showBack
      testID="affiliate-shopping-screen"
    >
      <View style={styles.searchCard}>
        <AppText variant="bodyStrong">식재료 검색</AppText>
        <View style={styles.searchRow}>
          <AppTextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={submitSearch}
            returnKeyType="search"
            placeholder="예: 대파, 달걀, 밀폐용기"
            accessibilityLabel="쿠팡 상품 검색어"
            style={styles.searchInput}
          />
          <Button
            icon={Search}
            onPress={submitSearch}
            loading={searchMutation.isPending}
            disabled={!query.trim()}
            size="small"
            testID="affiliate-shopping-search-button"
          >
            검색
          </Button>
        </View>
        {searchMutation.isError ? (
          <AppText variant="caption" tone="danger">
            {searchMutation.error instanceof Error
              ? searchMutation.error.message
              : "상품을 찾지 못했어요. 잠시 후 다시 시도해 주세요."}
          </AppText>
        ) : null}
        {searchMutation.isSuccess && !searchGroup ? (
          <AppText variant="bodySmall" tone="subtext">
            관련 상품을 찾지 못했어요. 다른 식재료 이름으로 검색해 보세요.
          </AppText>
        ) : null}
        {searchGroup ? (
          <View style={styles.resultBlock}>
            <AffiliateProductGroupView group={searchGroup} />
            <Disclosure text={searchMutation.data?.disclosure} />
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <AppText variant="heading">최근 다 쓴 재료</AppText>
          <AppText variant="bodySmall" tone="subtext">
            최근 30일 동안 모두 사용한 재료만 보여드려요.
          </AppText>
        </View>
        {shoppingQuery.isLoading ? (
          <View style={styles.loadingSkeleton} accessibilityLabel="최근 소비 상품을 불러오고 있어요">
            <View style={styles.skeletonCard} />
            <View style={styles.skeletonCard} />
          </View>
        ) : shoppingQuery.isError ? (
          <View style={styles.empty}>
            <AppText variant="bodySmall" tone="subtext">
              최근 재료를 불러오지 못했어요.
            </AppText>
            <Button variant="secondary" size="small" onPress={() => void shoppingQuery.refetch()}>
              다시 시도
            </Button>
          </View>
        ) : !shopping?.enabled ? (
          <View style={styles.empty}>
            <AppText variant="bodySmall" tone="subtext">장보기 기능을 준비하고 있어요.</AppText>
          </View>
        ) : shopping.productGroups.length === 0 ? (
          <View style={styles.empty}>
            <AppText variant="bodySmall">최근에 다 쓴 재료가 아직 없어요.</AppText>
            <AppText variant="caption" tone="subtext">
              위 검색창에서 필요한 식재료를 직접 찾아볼 수 있어요.
            </AppText>
          </View>
        ) : (
          <View style={styles.groups}>
            {shopping.productGroups.map((group) => (
              <AffiliateProductGroupView
                key={`${group.placement}:${group.query}`}
                group={group}
              />
            ))}
            <Disclosure text={shopping.disclosure} />
          </View>
        )}
      </View>

      <AppText variant="caption" tone="subtext">
        상품 가격과 배송 정보는 쿠팡에서 변경될 수 있으며, 결제와 배송은 쿠팡에서 처리됩니다.
      </AppText>
    </Screen>
  );
}

function Disclosure({ text }: { text?: string }) {
  return text ? <AppText variant="caption" tone="subtext">{text}</AppText> : null;
}

const styles = StyleSheet.create({
  searchCard: {
    gap: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.mutedSurface,
    padding: spacing.md,
  },
  searchRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  searchInput: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
  },
  resultBlock: { gap: spacing.sm, paddingTop: spacing.xs },
  section: { gap: spacing.md },
  sectionHeading: { gap: spacing.xxs },
  groups: { gap: spacing.lg },
  loadingSkeleton: {
    minHeight: 124,
    flexDirection: "row",
    gap: spacing.xs,
    overflow: "hidden",
  },
  skeletonCard: {
    width: 184,
    height: 124,
    borderRadius: radius.lg,
    backgroundColor: colors.mutedSurface,
  },
  empty: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.mutedSurface,
    padding: spacing.md,
  },
});
