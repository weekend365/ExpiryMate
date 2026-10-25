import { useState } from "react";
import { JangoHeroNoticeCarousel } from "../../components/JangoHeroNoticeCarousel";
import { SurfaceCard } from "../../components/SurfaceCard";
import { useResponsiveLayout } from "../../shared/responsive-layout";
import { getHomeHeroDensity } from "./home-hero-density";
import {
  getHeroTone,
  type HomeNotice,
  type HomeNoticeAction,
} from "./home-notices";
import { homeScreenStyles as styles } from "./home-screen-styles";

export function HomeHero({
  notices,
  onNoticeAction,
}: {
  notices: HomeNotice[];
  onNoticeAction: (action: HomeNoticeAction) => void;
}) {
  const [noticeIndex, setNoticeIndex] = useState(0);
  const { width, fontScale } = useResponsiveLayout();
  const activeNotice = notices[noticeIndex] ?? notices[0] ?? null;
  const heroTone = getHeroTone(activeNotice);

  if (!notices.length) {
    return null;
  }

  return (
    <SurfaceCard variant="hero" tone={heroTone} style={styles.heroCard}>
      <JangoHeroNoticeCarousel
        density={getHomeHeroDensity(width, fontScale)}
        layout={getHomeHeroDensity(width, fontScale) === "compact" ? "stacked" : "inline"}
        notices={notices.map((notice) => ({
          id: notice.id,
          message: notice.message,
          mood: notice.mood,
          onPress: notice.action
            ? () => onNoticeAction(notice.action!)
            : undefined,
          accessibilityHint: notice.actionHint,
        }))}
        bubbleStyle={styles.heroNotice}
        onIndexChange={setNoticeIndex}
      />
    </SurfaceCard>
  );
}
