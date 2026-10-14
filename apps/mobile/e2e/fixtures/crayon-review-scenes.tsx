// Local component QA with example data. No API, account, purchase or persistence calls.
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { ExpirySource } from "@expirymate/shared";
import { AppText } from "../../src/components/AppText";
import { JangoHeroNoticeCarousel } from "../../src/components/JangoHeroNoticeCarousel";
import { MascotSpeechBubble } from "../../src/components/MascotSpeechBubble";
import { InventoryListSkeleton } from "../../src/components/ContentSkeleton";
import { FeedbackBanner } from "../../src/components/FeedbackBanner";
import { getInventoryHeroNotice, getInventoryHeroNotices } from "../../src/features/inventory/inventory-hero";
import { inventoryScreenStyles } from "../../src/features/inventory/inventory-screen-styles";
import { inventoryFormStyles } from "../../src/features/inventory/inventory-form-ui";
import { getRegistrationCompletionNotices } from "../../src/features/registration/registration-completion-notices";
import { RegistrationCompletionActions } from "../../src/features/registration/registration-completion-actions";
import { HomeHero } from "../../src/features/home/home-hero";
import { getHomeNotices } from "../../src/features/home/home-notices";
import { spacing } from "../../src/shared/theme";

export const crayonReviewScenes = [
  "inventory-empty", "inventory-filtered", "inventory-loading", "inventory-error",
  "inventory-refresh-error", "inventory-calm", "registration-done", "registration-multiple",
  "registration-pending", "registration-error", "home-calm", "home-warning", "home-expired",
] as const;
export type CrayonReviewSceneName = typeof crayonReviewScenes[number];

// Historical entry names are retained for the existing QA app/manifest adapter.
export function CrayonReviewScene({ scene }: { scene: CrayonReviewSceneName }) {
  const [actions, setActions] = useState(0);
  const onAction = () => setActions(value => value + 1);
  let content;
  if (scene.startsWith("inventory-")) {
    const empty = ["inventory-empty", "inventory-loading", "inventory-error", "inventory-refresh-error"].includes(scene);
    const hero = getInventoryHeroNotice({
      isInitialLoading: scene === "inventory-loading", isInitialError: scene === "inventory-error",
      isSelectionMode: false, totalCount: empty ? 0 : 4,
      visibleCount: empty || scene === "inventory-filtered" ? 0 : 4,
      expiredCount: 0, within7Count: 0, statusFilter: "all",
    });
    const notices = getInventoryHeroNotices({ hero }).map(notice => ({
      ...notice, onPress: hero.show && hero.action ? onAction : undefined,
    }));
    content = <>
      {notices.length > 0 && <View style={[inventoryScreenStyles.filterToolbar,
        hero.show && hero.tone === "neutral" && inventoryScreenStyles.filterToolbarNeutralNotice,
        hero.show && hero.tone === "danger" && inventoryScreenStyles.filterToolbarDangerNotice,
        hero.show && hero.tone === "success" && inventoryScreenStyles.filterToolbarSuccessNotice,
      ]}><JangoHeroNoticeCarousel notices={notices} /></View>}
      {scene === "inventory-loading" && <InventoryListSkeleton />}
      {scene === "inventory-refresh-error" && <FeedbackBanner tone="danger" title="앗, 보관함을 불러오지 못했어요" description="검토용 새로고침 오류" actionLabel="다시 시도" onAction={onAction} />}
    </>;
  } else if (scene.startsWith("registration-")) {
    const done = scene === "registration-done" || scene === "registration-multiple";
    const notices = getRegistrationCompletionNotices({
      latestItem: done ? { displayName: "토마토", expiryDate: null, expirySource: ExpirySource.UNKNOWN } : null,
      sessionCount: scene === "registration-multiple" ? 2 : 1, onRecommendations: onAction,
    });
    content = done ? <>
      <View style={styles.doneHero}><View style={[inventoryFormStyles.sectionCard, inventoryFormStyles.sectionCardSoft, inventoryFormStyles.sectionCardPadded]}>
        <JangoHeroNoticeCarousel notices={notices} density="compact" textVariant="bodyStrong" bubbleStyle={styles.doneBubble} />
      </View></View>
      <RegistrationCompletionActions primaryLabel="다음 재료 직접 입력" onPrimary={onAction} onDone={onAction} tertiaryLabel="바코드로 추가" onTertiary={onAction} />
    </> : scene === "registration-pending"
      ? <MascotSpeechBubble mood="think" message="검토용 저장 대기 상태" />
      : <FeedbackBanner tone="danger" title="앗, 잠시 문제가 생겼어요" description="검토용 저장 실패 상태" />;
  } else {
    const notices = getHomeNotices({
      isInitialLoading: false, isInitialError: false, isRefreshError: false, loadErrorMessage: "",
      recipeStatus: "idle", recipeErrorMessage: null, expiringGroups: [],
      expiredCount: scene === "home-expired" ? 2 : 0, within7DaysCount: scene === "home-warning" ? 3 : 0,
      unknownExpiryCount: 0, hasInventory: true, hasLoaded: true,
    });
    content = <HomeHero notices={notices} onNoticeAction={onAction} />;
  }
  return <View style={styles.root}>
    <View testID="crayon-review-surface" style={styles.surface}>{content}</View>
    <AppText variant="caption" tone="muted" testID="qa-action-count">검토용 동작 확인: {actions}회</AppText>
  </View>;
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  surface: { gap: spacing.sm },
  // Same local doneHero/doneBubble styles as register.tsx; QA only, not a runtime route.
  doneHero: { alignItems: "stretch", gap: spacing.sm, paddingVertical: spacing.xs },
  doneBubble: { alignSelf: "stretch" },
});
