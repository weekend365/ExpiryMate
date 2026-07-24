import { appBrand } from "@expirymate/shared";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Button } from "../src/components/Button";
import { type MascotMood } from "../src/components/Mascot";
import { MascotSpeechBubble } from "../src/components/MascotSpeechBubble";
import { Screen } from "../src/components/Screen";
import { colors, radius, spacing, touchTarget, typography } from "../src/shared/theme";
import { useAppStore } from "../src/store/app-store";

type OnboardingStep = {
  key: string;
  eyebrow: string;
  title: string;
  description: string;
  mood: MascotMood;
  cta: string;
};

const STEPS: OnboardingStep[] = [
  {
    key: "welcome",
    eyebrow: appBrand.appNameKo,
    title: "장고에게 냉장고를 맡겨볼까요?",
    description: `${appBrand.characterNameKo}가 유통기한과 남은 재료를 함께 챙겨 드릴게요.`,
    mood: "happy",
    cta: "다음으로 갈게요",
  },
  {
    key: "expiry",
    eyebrow: "유통기한 챙기기",
    title: "임박하면 장고가 살짝 알려줄게요",
    description: "재료만 넣어두면, 언제 써야 할지 놓치지 않게 도와드려요.",
    mood: "worry",
    cta: "다음으로 갈게요",
  },
  {
    key: "recipe",
    eyebrow: "오늘 뭐 먹지?",
    title: "남은 재료로 요리를 같이 찾아볼게요",
    description: "냉장고 속 재료를 보고, 만들기 쉬운 요리를 골라 드릴게요.",
    mood: "cooking",
    cta: "다음으로 갈게요",
  },
  {
    key: "start",
    eyebrow: `${appBrand.appNameEn}`,
    title: "계정으로 이어가면 시작할 수 있어요",
    description: "카카오·네이버 등으로 이어가면, 장고가 재료를 안전하게 챙겨 드릴게요.",
    mood: "happy",
    cta: "계정으로 이어갈게요",
  },
];

const SPRING = {
  damping: 18,
  stiffness: 200,
  mass: 0.85,
};

export default function OnboardingScreen() {
  const completeOnboarding = useAppStore((state) => state.completeOnboarding);
  const [stepIndex, setStepIndex] = useState(0);
  const [heroMood, setHeroMood] = useState<MascotMood>("idle");
  const opacity = useSharedValue(1);
  const offset = useSharedValue(0);

  const step = STEPS[stepIndex];
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === STEPS.length - 1;

  useEffect(() => {
    if (!isFirstStep) {
      setHeroMood(step.mood);
      return;
    }

    setHeroMood("idle");
    const timer = setTimeout(() => setHeroMood("happy"), 700);
    return () => clearTimeout(timer);
  }, [isFirstStep, step.mood, stepIndex]);

  useEffect(() => {
    opacity.value = 0;
    offset.value = spacing.sm;
    opacity.value = withSpring(1, SPRING);
    offset.value = withSpring(0, SPRING);
  }, [offset, opacity, stepIndex]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: offset.value }],
  }));

  const handlePrimary = () => {
    if (isLastStep) {
      completeOnboarding();
      router.replace("/auth/login");
      return;
    }

    setStepIndex((current) => Math.min(current + 1, STEPS.length - 1));
  };

  const handleBack = () => {
    if (isFirstStep) {
      return;
    }

    setStepIndex((current) => Math.max(current - 1, 0));
  };

  return (
    <Screen
      scroll={false}
      contentWidth="form"
      footer={
        <Button onPress={handlePrimary} fullWidth>
          {step.cta}
        </Button>
      }
    >
      <View style={styles.topBar}>
        <View style={styles.progressTrack}>
          {STEPS.map((item, index) => (
            <View
              key={item.key}
              style={[
                styles.progressSegment,
                index <= stepIndex && styles.progressSegmentActive,
              ]}
            />
          ))}
        </View>
        {!isFirstStep ? (
          <Pressable
            onPress={handleBack}
            hitSlop={spacing.xs}
            style={({ pressed }) => [
              styles.backLink,
              pressed && styles.backLinkPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="이전으로 돌아가기"
          >
            <Text style={styles.backLinkText}>뒤로</Text>
          </Pressable>
        ) : (
          <View style={styles.backLinkSpacer} />
        )}
      </View>

      <Animated.View style={[styles.hero, contentStyle]}>
        <Text style={styles.brand}>{appBrand.appNameKo}</Text>
        <Text style={styles.brandEn}>{appBrand.appNameEn}</Text>

        <View style={styles.copy}>
          <Text style={styles.eyebrow}>{step.eyebrow}</Text>
          <Text style={styles.title}>{step.title}</Text>
        </View>

        <MascotSpeechBubble
          message={step.description}
          mood={isFirstStep ? heroMood : step.mood}
          size="medium"
          style={styles.guideBubble}
        />
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    gap: spacing.sm,
  },
  progressTrack: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  progressSegment: {
    flex: 1,
    height: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.mutedSurface,
  },
  progressSegmentActive: {
    backgroundColor: colors.primary,
  },
  backLink: {
    alignSelf: "flex-start",
    minHeight: touchTarget.min,
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
  },
  backLinkPressed: {
    opacity: 0.7,
  },
  backLinkSpacer: {
    height: touchTarget.min,
  },
  backLinkText: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.subtext,
  },
  hero: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  brand: {
    fontSize: typography.title.fontSize,
    lineHeight: typography.title.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.primary,
    textAlign: "center",
  },
  brandEn: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.subtext,
    textAlign: "center",
    marginTop: -spacing.sm,
  },
  guideBubble: {
    alignSelf: "stretch",
  },
  copy: {
    gap: spacing.sm,
    alignItems: "center",
  },
  eyebrow: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.primary,
    textAlign: "center",
  },
  title: {
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
    fontFamily: typography.heading.fontFamily,
    color: colors.text,
    textAlign: "center",
  },
});
