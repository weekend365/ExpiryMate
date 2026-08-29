import { appBrand } from "@expirymate/shared";
import { router } from "expo-router";
import {
  Bell,
  ChefHat,
  CreditCard,
  MapPin,
  MessageCircleHeart,
  ShieldCheck,
  Ticket,
  UserRound,
  Users,
} from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { AppText } from "../../src/components/AppText";
import { ListRow } from "../../src/components/ListRow";
import { Mascot } from "../../src/components/Mascot";
import { Screen } from "../../src/components/Screen";
import { SectionHeader } from "../../src/components/SectionHeader";
import { useMonetization } from "../../src/features/monetization/monetization-provider";
import { colors, radius, spacing, typography } from "../../src/shared/theme";
import { useResponsiveLayout } from "../../src/shared/responsive-layout";

export default function SettingsScreen() {
  const monetization = useMonetization();
  const { shouldStack } = useResponsiveLayout();

  return (
    <Screen bottomInsetMode="navigator" testID="settings-screen">
      <View style={[styles.brandCard, shouldStack && styles.brandCardStacked]}>
        <Mascot size="small" mood="idle" />
        <View style={styles.brandCopy}>
          <AppText variant="heading" style={styles.brandName}>
            {appBrand.appNameKo}
          </AppText>
          <AppText variant="caption" tone="subtext">
            {appBrand.appNameEn} · {appBrand.productLineKo}
          </AppText>
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="내 장고 설정"
          description="알림, 추천, 냉장고, 계정을 여기서 바꿔요."
        />
        <View style={styles.card}>
          <ListRow
            title="알림"
            description="유통기한 알림 시점과 켜고 끄기를 맞춰요."
            icon={Bell}
            onPress={() => router.push("/settings/notifications")}
          />
          <ListRow
            title="요리 추천 맞춤 설정"
            description="알레르기, 식단, 매운맛과 조리도구를 기억해요."
            icon={ChefHat}
            onPress={() => router.push("/settings/recipe-preferences")}
          />
          <ListRow
            title="보관 위치"
            description="냉장·냉동 외에 나만의 자리를 추가해요."
            icon={MapPin}
            onPress={() => router.push("/settings/storage-locations")}
          />
          <ListRow
            title="함께 쓰는 냉장고"
            description="가족이나 동료를 초대하고 냉장고를 바꿔요."
            icon={Users}
            onPress={() => router.push("/settings/spaces")}
          />
          <ListRow
            title="계정"
            description="내 계정 확인, 로그아웃, 계정 정리를 살펴봐요."
            icon={UserRound}
            onPress={() => router.push("/settings/account")}
          />
          {monetization.access?.subscriptionsEnabled ||
          monetization.access?.tier === "jango_plus" ||
          monetization.access?.tier === "jango_household" ? (
            <ListRow
              title="장고 플러스"
              description={
                monetization.access.tier === "jango_household"
                  ? `가족 플러스 · 하루 최대 ${monetization.access.householdDailyLimit}회 추천을 함께 써요.`
                  : monetization.access.tier === "jango_plus"
                    ? "이용 중 · 30·90일 폐기 예방 리포트와 광고 없는 AI를 확인해요."
                    : "30·90일 폐기 예방 리포트와 광고 없는 AI를 살펴봐요."
              }
              icon={CreditCard}
              onPress={() => router.push("/settings/subscription")}
            />
          ) : null}
          {monetization.access?.paidCredits.enabled ? (
            <ListRow
              title="AI 추천권"
              description={
                monetization.access.paidCredits.salesEnabled
                  ? `보유 ${monetization.access.paidCredits.balance}회 · 필요한 만큼만 충전해요.`
                  : `보유 ${monetization.access.paidCredits.balance}회 · 추천할 때 자동 사용돼요.`
              }
              icon={Ticket}
              onPress={
                monetization.access.paidCredits.salesEnabled
                  ? () => router.push("/settings/recommendation-credits")
                  : undefined
              }
            />
          ) : null}
          <ListRow
            title="장고에게 물어보기"
            description="불편한 점이나 궁금한 점을 남겨 주세요."
            icon={MessageCircleHeart}
            onPress={() => router.push("/settings/support")}
          />
          <ListRow
            title="개인정보"
            description="어떤 정보를 쓰는지, 어떻게 지울 수 있는지 같이 볼게요."
            icon={ShieldCheck}
            last
            onPress={() => router.push("/privacy")}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  brandCardStacked: {
    flexDirection: "column",
    alignItems: "flex-start",
  },
  brandCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  brandName: {
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
    fontFamily: typography.heading.fontFamily,
    color: colors.text,
  },
  brandMeta: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.primary,
  },
  brandNote: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.subtext,
  },
  section: {
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
});
