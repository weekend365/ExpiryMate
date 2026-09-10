import { appBrand } from "@expirymate/shared";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppText } from "../src/components/AppText";
import { BottomSheet } from "../src/components/BottomSheet";
import { Button } from "../src/components/Button";
import { Mascot } from "../src/components/Mascot";
import { Screen } from "../src/components/Screen";
import { StatCard } from "../src/components/StatCard";
import { colors, radius, spacing } from "../src/shared/theme";
import { useAppStore } from "../src/store/app-store";

export default function OnboardingScreen() {
  const completeOnboarding = useAppStore((state) => state.completeOnboarding);
  const [showGuide, setShowGuide] = useState(false);
  const start = () => {
    completeOnboarding();
    router.replace("/auth/login");
  };
  return (
    <Screen
      contentWidth="form"
      testID="onboarding-screen"
      footer={
        <View style={styles.actions}>
          <Button fullWidth onPress={start} testID="onboarding-next-button">로그인하고 시작하기</Button>
          <Button fullWidth variant="surface" onPress={() => setShowGuide(true)} testID="onboarding-guide-button">사용법 보기</Button>
        </View>
      }
    >
      <View style={styles.hero}>
        <AppText variant="label" tone="primary">{appBrand.appNameKo}</AppText>
        <Mascot size="medium" mood="happy" />
        <AppText variant="heading" style={styles.centered}>재료를 넣으면 기한을 챙기고 요리를 추천해요</AppText>
        <AppText variant="body" tone="subtext" style={styles.centered}>남은 재료를 알뜰한 한 끼로 이어보세요.</AppText>
      </View>
      <View style={styles.example}>
        <AppText variant="bodyStrong">유통기한을 한눈에 확인해요</AppText>
        <AppText variant="caption" tone="subtext">사용 예시 · 실제 보관함이 아니에요</AppText>
        <View style={styles.lamps}>
          <StatCard variant="traffic" compact label="확인" value={0} tone="unknown" showGlow={false} />
          <StatCard variant="traffic" compact label="만료" value={0} tone="danger" />
          <StatCard variant="traffic" compact label="곧" value={2} tone="warning" />
          <StatCard variant="traffic" compact label="여유" value={3} tone="success" showGlow={false} />
        </View>
        <AppText variant="bodySmall" tone="subtext">기한이 가까운 재료부터 살펴보고, 보관 중인 재료로 요리를 찾아보세요.</AppText>
      </View>
      <BottomSheet visible={showGuide} onClose={() => setShowGuide(false)} title="장고 사용법" footer={<Button fullWidth onPress={() => setShowGuide(false)}>사용법 닫기</Button>}>
        <View style={styles.actions}>
          <AppText variant="bodyStrong">1. 재료 넣기</AppText>
          <AppText variant="body" tone="subtext">바코드나 직접 입력으로 재료와 기한을 등록해요.</AppText>
          <AppText variant="bodyStrong">2. 기한 확인하기</AppText>
          <AppText variant="body" tone="subtext">홈의 신호등을 누르면 해당 재료를 볼 수 있어요. 쓴 재료는 보관함의 사용 기록으로 반영해 주세요.</AppText>
          <AppText variant="bodyStrong">3. 요리 추천받기</AppText>
          <AppText variant="body" tone="subtext">보관 재료에 맞는 요리를 고르고, 조리를 마친 뒤 남은 양을 확인해요.</AppText>
        </View>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  centered: { textAlign: "center" },
  example: { gap: spacing.sm, padding: spacing.sm, backgroundColor: colors.surfaceWarm, borderRadius: radius.xxl },
  lamps: { flexDirection: "row", gap: spacing.xs },
  actions: { gap: spacing.xs },
});
