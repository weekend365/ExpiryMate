import { appBrand } from "@expirymate/shared";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import welcomeBackground from "../assets/backgrounds/home-welcome-bg.png";
import { Button } from "../src/components/Button";
import { AppText } from "../src/components/AppText";
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
    title: "이제부터 지구에 버려지는 식재료는 없다!",
    description: "남은 재료도 알뜰하게, 장고가 맛있는 한 끼로 이어드릴게요.",
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
    title: "로그인하면 바로 시작할 수 있어요",
    description:
      "카카오·네이버·Google·Apple 또는 이메일로 들어가면, 장고가 재료를 챙겨 드릴게요.",
    mood: "happy",
    cta: "로그인",
  },
];

const SPRING = {
  damping: 18,
  stiffness: 200,
  mass: 0.85,
};

function ProgressTrack({
  stepIndex,
  dark,
}: {
  stepIndex: number;
  dark?: boolean;
}) {
  return (
    <View style={styles.progressTrack}>
      {STEPS.map((item, index) => (
        <View
          key={item.key}
          style={[
            styles.progressSegment,
            dark && styles.progressSegmentDark,
            index <= stepIndex && styles.progressSegmentActive,
          ]}
        />
      ))}
    </View>
  );
}

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
    if (isFirstStep) {
      return;
    }

    setHeroMood(step.mood);
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

  if (isFirstStep) {
    return (
      <ImageBackground
        source={welcomeBackground}
        style={styles.welcomeRoot}
        resizeMode="cover"
        accessible={false}
        testID="onboarding-screen"
      >
        <SafeAreaView
          style={styles.welcomeSafe}
          edges={["top", "right", "left"]}
        >
          <ScrollView
            style={styles.welcomeScroll}
            contentContainerStyle={styles.welcomeContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.topBar}>
              <ProgressTrack stepIndex={stepIndex} dark />
              <View style={styles.backLinkSpacer} />
            </View>

            <Animated.View style={[styles.welcomeCopyCard, contentStyle]}>
              <AppText variant="label" tone="primary" style={styles.welcomeEyebrow}>
                {step.eyebrow}
              </AppText>
              <AppText variant="heading" style={styles.welcomeTitle}>
                {step.title}
              </AppText>
              <AppText variant="body" tone="subtext" style={styles.welcomeDescription}>
                {step.description}
              </AppText>
            </Animated.View>

            <View style={styles.welcomeHeroSpacer} />
          </ScrollView>
          <SafeAreaView style={styles.welcomeFooter} edges={["bottom"]}>
            <Button
              onPress={handlePrimary}
              fullWidth
              testID="onboarding-next-button"
            >
              {step.cta}
            </Button>
          </SafeAreaView>
        </SafeAreaView>
      </ImageBackground>
    );
  }

  return (
    <Screen
      contentWidth="form"
      testID="onboarding-screen"
      footer={
        <Button
          onPress={handlePrimary}
          fullWidth
          testID="onboarding-next-button"
        >
          {step.cta}
        </Button>
      }
    >
      <View style={styles.topBar}>
        <ProgressTrack stepIndex={stepIndex} />
        <Pressable
          onPress={handleBack}
          hitSlop={spacing.xs}
          style={({ pressed }) => [
            styles.backLink,
            pressed && styles.backLinkPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="뒤로가기"
        >
          <AppText style={styles.backLinkText}>뒤로가기</AppText>
        </Pressable>
      </View>

      <Animated.View style={[styles.hero, contentStyle]}>
        <AppText style={styles.brand}>{appBrand.appNameKo}</AppText>
        <AppText style={styles.brandEn}>{appBrand.appNameEn}</AppText>

        <View style={styles.copy}>
          <AppText style={styles.eyebrow}>{step.eyebrow}</AppText>
          <AppText style={styles.title}>{step.title}</AppText>
        </View>

        <MascotSpeechBubble
          message={step.description}
          mood={heroMood}
          size="medium"
          style={styles.guideBubble}
        />
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  welcomeRoot: {
    flex: 1,
    backgroundColor: colors.background,
  },
  welcomeSafe: {
    flex: 1,
  },
  welcomeScroll: {
    flex: 1,
  },
  welcomeContent: {
    flexGrow: 1,
    gap: spacing.md,
  },
  welcomeCopyCard: {
    marginHorizontal: spacing.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  welcomeEyebrow: {
    textAlign: "center",
  },
  welcomeTitle: {
    textAlign: "center",
  },
  welcomeDescription: {
    textAlign: "center",
  },
  welcomeHeroSpacer: {
    flex: 1,
    minHeight: spacing.xxxl * 3,
  },
  welcomeFooter: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
  },
  topBar: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
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
  progressSegmentDark: {
    backgroundColor: colors.cameraControl,
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
