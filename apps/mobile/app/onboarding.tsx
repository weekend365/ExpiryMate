import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "../src/components/Button";
import { Screen } from "../src/components/Screen";
import { colors, spacing } from "../src/shared/theme";
import { useAppStore } from "../src/store/app-store";

export default function OnboardingScreen() {
  const completeOnboarding = useAppStore((state) => state.completeOnboarding);

  const handleStart = () => {
    completeOnboarding();
    router.replace("/(tabs)/home");
  };

  return (
    <Screen scroll={false}>
      <View style={styles.hero}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>ExpiryMate</Text>
        </View>
        <Text style={styles.title}>집에 있는 물건을 바코드로 빠르게 정리하세요</Text>
        <Text style={styles.description}>
          바코드로 상품을 찾고, 유통기한은 따로 입력해서 놓치지 않게 관리해요.
        </Text>
        <View style={styles.points}>
          <Text style={styles.point}>빠르게 등록</Text>
          <Text style={styles.point}>유통기한 놓치지 않기</Text>
          <Text style={styles.point}>중복 구매 줄이기</Text>
          <Text style={styles.point}>집에 뭐 있는지 바로 확인하기</Text>
        </View>
      </View>
      <Button onPress={handleStart}>시작하기</Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.lg,
    paddingTop: 56,
    paddingBottom: 40,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  badgeText: {
    color: colors.primary,
    fontWeight: "700",
  },
  title: {
    fontSize: 34,
    lineHeight: 42,
    fontWeight: "800",
    color: colors.text,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.subtext,
  },
  points: {
    backgroundColor: colors.surface,
    borderRadius: 28,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  point: {
    fontSize: 16,
    color: colors.text,
    fontWeight: "600",
  },
});
