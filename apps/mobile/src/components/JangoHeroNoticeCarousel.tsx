import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, radius, spacing } from "../shared/theme";
import type { AppTextVariant } from "./AppText";
import type { MascotMood } from "./Mascot";
import { MascotSpeechBubble } from "./MascotSpeechBubble";

export type JangoHeroNoticeItem = {
  id: string;
  message: string;
  mood?: MascotMood;
  supportingMessage?: string;
  onPress?: () => void;
  accessibilityHint?: string;
};

type JangoHeroNoticeCarouselProps = {
  notices: JangoHeroNoticeItem[];
  size?: "small" | "medium";
  density?: "default" | "compact";
  textVariant?: AppTextVariant;
  bubbleStyle?: StyleProp<ViewStyle>;
  onIndexChange?: (index: number) => void;
};

export function JangoHeroNoticeCarousel({
  notices,
  size = "small",
  density = "default",
  textVariant,
  bubbleStyle,
  onIndexChange,
}: JangoHeroNoticeCarouselProps) {
  const [noticeIndex, setNoticeIndex] = useState(0);
  const [carouselWidth, setCarouselWidth] = useState(0);
  const noticeCarouselRef = useRef<ScrollView>(null);
  const onIndexChangeRef = useRef(onIndexChange);
  onIndexChangeRef.current = onIndexChange;

  const noticeIds = notices.map((notice) => notice.id).join("|");
  const hasMultipleNotices = notices.length > 1;
  const activeNotice = notices[noticeIndex] ?? notices[0] ?? null;

  useEffect(() => {
    setNoticeIndex(0);
    onIndexChangeRef.current?.(0);
    noticeCarouselRef.current?.scrollTo({ x: 0, animated: false });
  }, [noticeIds]);

  if (notices.length === 0) {
    return null;
  }

  const setIndex = (nextIndex: number) => {
    const clamped = Math.max(0, Math.min(nextIndex, notices.length - 1));
    setNoticeIndex(clamped);
    onIndexChangeRef.current?.(clamped);
  };

  const handleNoticeScrollEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    if (carouselWidth <= 0) {
      return;
    }

    setIndex(Math.round(event.nativeEvent.contentOffset.x / carouselWidth));
  };

  return (
    <View
      style={[
        styles.noticeBlock,
        hasMultipleNotices && styles.noticeBlockCarousel,
      ]}
      onLayout={(event) => {
        const width = event.nativeEvent.layout.width;
        if (width > 0 && width !== carouselWidth) {
          setCarouselWidth(width);
        }
      }}
    >
      {hasMultipleNotices ? (
        <View
          style={styles.noticeGuide}
          accessibilityRole="text"
          accessibilityLabel={`${notices.length}개 소식 중 ${noticeIndex + 1}번째. 옆으로 밀면 다음 소식을 볼 수 있어요.`}
        >
          <View style={styles.noticeDots}>
            {notices.map((notice, index) => (
              <View
                key={notice.id}
                style={[
                  styles.noticeDot,
                  index === noticeIndex && styles.noticeDotActive,
                ]}
              />
            ))}
          </View>
        </View>
      ) : null}

      {carouselWidth > 0 && hasMultipleNotices ? (
        <ScrollView
          ref={noticeCarouselRef}
          horizontal
          pagingEnabled
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleNoticeScrollEnd}
          decelerationRate="fast"
          style={{ width: carouselWidth }}
        >
          {notices.map((notice) => (
            <View
              key={notice.id}
              style={[styles.noticePage, { width: carouselWidth }]}
            >
              <JangoHeroNoticeBubble
                notice={notice}
                size={size}
                density={density}
                textVariant={textVariant}
                bubbleStyle={bubbleStyle}
              />
            </View>
          ))}
        </ScrollView>
      ) : activeNotice ? (
        <JangoHeroNoticeBubble
          notice={activeNotice}
          size={size}
          density={density}
          textVariant={textVariant}
          bubbleStyle={bubbleStyle}
        />
      ) : null}
    </View>
  );
}

function JangoHeroNoticeBubble({
  notice,
  size,
  density,
  textVariant,
  bubbleStyle,
}: {
  notice: JangoHeroNoticeItem;
  size: "small" | "medium";
  density: "default" | "compact";
  textVariant?: AppTextVariant;
  bubbleStyle?: StyleProp<ViewStyle>;
}) {
  const bubble = (
    <MascotSpeechBubble
      message={notice.message}
      supportingMessage={notice.supportingMessage}
      mood={notice.mood}
      size={size}
      density={density}
      textVariant={textVariant}
      style={bubbleStyle}
    />
  );

  if (!notice.onPress) {
    return bubble;
  }

  return (
    <Pressable
      onPress={notice.onPress}
      accessibilityRole="button"
      accessibilityLabel={notice.message}
      accessibilityHint={notice.accessibilityHint}
      style={({ pressed }) => [pressed && styles.noticePressed]}
    >
      {bubble}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  noticeBlock: {
    gap: spacing.xs,
    justifyContent: "center",
  },
  noticeBlockCarousel: {
    minHeight: spacing.xxxl + spacing.md,
  },
  noticeGuide: {
    alignItems: "center",
    justifyContent: "center",
  },
  noticeDots: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  noticeDot: {
    width: spacing.xs,
    height: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  noticeDotActive: {
    backgroundColor: colors.primary,
    width: spacing.sm,
  },
  noticePage: {
    justifyContent: "center",
  },
  noticePressed: {
    opacity: 0.88,
  },
});
