import { appBrand } from "@expirymate/shared";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { AppTextInput } from "../../src/components/AppTextInput";
import { Button } from "../../src/components/Button";
import { EmailDomainInput } from "../../src/components/EmailDomainInput";
import { Mascot } from "../../src/components/Mascot";
import { Screen } from "../../src/components/Screen";
import { useAuth } from "../../src/features/auth/use-auth";
import { continuePendingSpaceInvitation } from "../../src/features/spaces/pending-invitation";
import { publicWebUrl } from "../../src/shared/public-web-url";
import {
  colors,
  radius,
  spacing,
  touchTarget,
  typography,
} from "../../src/shared/theme";

type RegisterStep = "name" | "email" | "password";

const STEPS: Array<{
  key: RegisterStep;
  title: string;
  description: string;
}> = [
  {
    key: "name",
    title: "어떻게 불러드릴까요?",
    description: "닉네임은 나중에 바꿔도 괜찮아요.",
  },
  {
    key: "email",
    title: "이메일을 알려주세요",
    description: "나중에 다시 만날 때 쓸 이메일이에요.",
  },
  {
    key: "password",
    title: "비밀번호를 정해 주세요",
    description: "8자 이상으로 안전하게 만들어 주세요.",
  },
];

const SPRING = {
  damping: 18,
  stiffness: 200,
  mass: 0.85,
};

export default function RegisterScreen() {
  const { registerMutation } = useAuth();
  const [stepIndex, setStepIndex] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const opacity = useSharedValue(1);
  const offset = useSharedValue(0);

  const step = STEPS[stepIndex];
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === STEPS.length - 1;
  const canContinue =
    step.key === "name" ||
    (step.key === "email" && Boolean(email.trim())) ||
    (step.key === "password" && password.length >= 8);

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

  const handleRegister = async () => {
    try {
      const result = await registerMutation.mutateAsync({
        email,
        password,
        displayName: displayName || undefined,
      });

      if (
        "requiresEmailVerification" in result &&
        result.requiresEmailVerification
      ) {
        router.replace({
          pathname: "/auth/verify-pending",
          params: { email: result.email },
        });
        return;
      }

      if (!(await continuePendingSpaceInvitation())) {
        router.replace("/(tabs)/home");
      }
    } catch (error) {
      Alert.alert("앗, 잠시 문제가 생겼어요", getErrorMessage(error));
    }
  };

  const handlePrimary = () => {
    if (isLastStep) {
      void handleRegister();
      return;
    }

    setStepIndex((current) => Math.min(current + 1, STEPS.length - 1));
  };

  const handleBack = () => {
    if (isFirstStep) {
      router.back();
      return;
    }

    setStepIndex((current) => Math.max(current - 1, 0));
  };

  return (
    <Screen
      contentWidth="form"
      footer={
        <Button
          onPress={handlePrimary}
          loading={registerMutation.isPending}
          disabled={!canContinue}
          fullWidth
        >
          {isLastStep ? "회원가입" : "다음"}
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
        <Pressable
          onPress={handleBack}
          hitSlop={spacing.xs}
          accessibilityRole="button"
          accessibilityLabel={isFirstStep ? "나중에 할게요" : "뒤로가기"}
          style={({ pressed }) => [
            styles.backLink,
            pressed && styles.backLinkPressed,
          ]}
        >
          <Text style={styles.backLinkText}>
            {isFirstStep ? "나중에 할게요" : "뒤로가기"}
          </Text>
        </Pressable>
      </View>

      <Animated.View style={[styles.stepBody, contentStyle]}>
        <Mascot size="small" mood="idle" style={styles.mascot} />
        <Text style={styles.stepEyebrow}>
          {appBrand.characterNameKo}랑 회원가입할까요?
        </Text>
        <Text style={styles.stepTitle}>{step.title}</Text>
        <Text style={styles.stepDescription}>{step.description}</Text>

        {step.key === "name" ? (
          <AppTextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="이름 또는 닉네임"
            style={styles.input}
            returnKeyType="next"
            onSubmitEditing={handlePrimary}
          />
        ) : null}

        {step.key === "email" ? (
          <EmailDomainInput
            value={email}
            onChangeText={setEmail}
            placeholder="이메일"
            returnKeyType="next"
            onSubmitEditing={handlePrimary}
          />
        ) : null}

        {step.key === "password" ? (
          <AppTextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="비밀번호 8자 이상"
            style={styles.input}
            returnKeyType="done"
            onSubmitEditing={handlePrimary}
          />
        ) : null}

        {isLastStep ? (
          <View style={styles.legalLinks}>
            <Text style={styles.legalLead}>
              가입하면 이용약관과 개인정보 안내에 동의하는 걸로 볼게요.
            </Text>
            <View style={styles.legalRow}>
              <Pressable
                onPress={() => void Linking.openURL(publicWebUrl("/terms"))}
                hitSlop={spacing.xs}
                accessibilityRole="link"
                accessibilityLabel="이용약관 살펴보기"
                style={({ pressed }) => [
                  styles.legalLink,
                  pressed && styles.legalLinkPressed,
                ]}
              >
                <Text style={styles.legalLinkText}>이용약관</Text>
              </Pressable>
              <Text style={styles.legalDot}>·</Text>
              <Pressable
                onPress={() => void Linking.openURL(publicWebUrl("/privacy"))}
                hitSlop={spacing.xs}
                accessibilityRole="link"
                accessibilityLabel="개인정보 안내 살펴보기"
                style={({ pressed }) => [
                  styles.legalLink,
                  pressed && styles.legalLinkPressed,
                ]}
              >
                <Text style={styles.legalLinkText}>개인정보 안내</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </Animated.View>
    </Screen>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?";
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
  backLinkText: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.subtext,
  },
  stepBody: {
    gap: spacing.sm,
  },
  mascot: {
    alignSelf: "flex-start",
  },
  stepEyebrow: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.subtext,
  },
  stepTitle: {
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
    fontFamily: typography.heading.fontFamily,
    color: colors.text,
  },
  stepDescription: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.subtext,
  },
  input: {
    minHeight: touchTarget.cta,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: typography.body.fontSize,
    fontFamily: typography.body.fontFamily,
    marginTop: spacing.xs,
  },
  legalLinks: {
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  legalLead: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.caption.fontFamily,
    color: colors.mutedText,
    textAlign: "center",
  },
  legalRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  legalLink: {
    minHeight: touchTarget.min,
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
  },
  legalLinkPressed: {
    opacity: 0.7,
  },
  legalLinkText: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.primary,
  },
  legalDot: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.caption.fontFamily,
    color: colors.mutedText,
  },
});
