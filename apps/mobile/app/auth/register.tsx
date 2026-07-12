import { appBrand } from "@expirymate/shared";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Button } from "../../src/components/Button";
import { Mascot } from "../../src/components/Mascot";
import { Screen } from "../../src/components/Screen";
import { useAuth } from "../../src/features/auth/use-auth";
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
      await registerMutation.mutateAsync({
        email,
        password,
        displayName: displayName || undefined,
      });
      Alert.alert(
        "환영해요!",
        "확인 메일을 보냈어요. 익명으로 넣은 재료도 계정으로 잘 옮겨 뒀어요.",
      );
      router.back();
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
      title="함께 시작하기"
      subtitle={`${appBrand.characterNameKo}랑 계정을 만들어볼까요?`}
      footer={
        <Button
          onPress={handlePrimary}
          loading={registerMutation.isPending}
          disabled={!canContinue}
          fullWidth
        >
          {isLastStep ? "가입하고 연결할게요" : "다음으로 갈게요"}
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
          style={({ pressed }) => [
            styles.backLink,
            pressed && styles.backLinkPressed,
          ]}
        >
          <Text style={styles.backLinkText}>
            {isFirstStep ? "나중에 할게요" : "뒤로"}
          </Text>
        </Pressable>
      </View>

      <Animated.View style={[styles.stepBody, contentStyle]}>
        <Mascot size="small" mood="idle" style={styles.mascot} />
        <Text style={styles.stepTitle}>{step.title}</Text>
        <Text style={styles.stepDescription}>{step.description}</Text>

        {step.key === "name" ? (
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="이름 또는 닉네임"
            placeholderTextColor={colors.mutedText}
            style={styles.input}
          />
        ) : null}

        {step.key === "email" ? (
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="예: jango@example.com"
            placeholderTextColor={colors.mutedText}
            style={styles.input}
          />
        ) : null}

        {step.key === "password" ? (
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="비밀번호 8자 이상"
            placeholderTextColor={colors.mutedText}
            style={styles.input}
          />
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
    fontWeight: typography.bodyStrong.fontWeight,
    color: colors.subtext,
  },
  stepBody: {
    gap: spacing.sm,
  },
  mascot: {
    alignSelf: "flex-start",
  },
  stepTitle: {
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
    fontWeight: typography.heading.fontWeight,
    color: colors.text,
  },
  stepDescription: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
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
    fontWeight: typography.body.fontWeight,
    marginTop: spacing.xs,
  },
});
