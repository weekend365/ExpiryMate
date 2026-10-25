import { appBrand } from "@expirymate/shared";
import { router } from "expo-router";
import {
  Bell,
  ChefHat,
  CreditCard,
  MapPin,
  MessageCircleHeart,
  ShieldCheck,
  Sun,
  Ticket,
  UserRound,
  Users,
} from "lucide-react-native";
import { StyleSheet, Switch, View } from "react-native";
import { AppText } from "../../src/components/AppText";
import { ListRow } from "../../src/components/ListRow";
import { Mascot } from "../../src/components/Mascot";
import { Screen } from "../../src/components/Screen";
import { SectionHeader } from "../../src/components/SectionHeader";
import { useMonetization } from "../../src/features/monetization/monetization-provider";
import { colors, radius, spacing, typography } from "../../src/shared/theme";
import { useResponsiveLayout } from "../../src/shared/responsive-layout";
import { useAppStore } from "../../src/store/app-store";

export default function SettingsScreen() {
  const monetization = useMonetization();
  const { shouldStack } = useResponsiveLayout();
  const keepCookingScreenAwake = useAppStore(
    (state) => state.keepCookingScreenAwake,
  );
  const setKeepCookingScreenAwake = useAppStore(
    (state) => state.setKeepCookingScreenAwake,
  );

  return (
    <Screen background="settings" bottomInsetMode="navigator" testID="settings-screen">
      <View style={[styles.brandCard, shouldStack && styles.brandCardStacked]}>
        <Mascot size="medium" mood="acknowledge" decorative />
        <View style={styles.brandCopy}>
          <AppText variant="heading" style={styles.brandName}>
            {appBrand.appNameKo}
          </AppText>
          <AppText variant="bodySmall">알림과 추천을 생활 리듬에 맞춰봐요.</AppText>
          <AppText variant="caption" tone="subtext">
            {appBrand.appNameEn} · {appBrand.productLineKo}
          </AppText>
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="내 장고 설정"
        />
        <View style={styles.card}>
          <ListRow
            title="알림"
            description="기한 알림 시점·시간"
            icon={Bell}
            onPress={() => router.push("/settings/notifications")}
          />
          <ListRow
            title="추천 맞춤 설정"
            description="알레르기·식단·매운맛·조리도구"
            icon={ChefHat}
            onPress={() => router.push("/settings/recipe-preferences")}
          />
          <ListRow
            title="조리 중 화면 켜두기"
            description={keepCookingScreenAwake ? "켜짐 · 조리 중 화면 꺼짐을 막아요." : "꺼짐 · 기기의 화면 설정을 따라요."}
            icon={Sun}
            trailing={
              <Switch
                value={keepCookingScreenAwake}
                onValueChange={setKeepCookingScreenAwake}
                accessibilityLabel="조리 중 화면 켜두기"
                trackColor={{
                  false: colors.border,
                  true: colors.primarySoft,
                }}
                thumbColor={
                  keepCookingScreenAwake
                    ? colors.primaryForeground
                    : colors.mutedSurface
                }
              />
            }
          />
          <ListRow
            title="보관 위치"
            description="냉장·냉동·나만의 위치"
            icon={MapPin}
            onPress={() => router.push("/settings/storage-locations")}
          />
          <ListRow
            title="함께 쓰는 냉장고"
            description="가족·동료 초대와 냉장고 전환"
            icon={Users}
            onPress={() => router.push("/settings/spaces")}
          />
          <ListRow
            title="계정"
            description="계정 정보·로그아웃·계정 정리"
            icon={UserRound}
            onPress={() => router.push("/settings/account")}
          />
          {/* Keep purchase restoration reachable even when new sales are paused. */}
          <ListRow
            title="장고 플러스"
            description={
              monetization.access?.tier === "jango_household"
                ? `가족 플러스 · 하루 최대 ${monetization.access.householdDailyLimit}회 추천을 함께 써요.`
                : monetization.access?.tier === "jango_plus"
                  ? "이용 중 · 30·90일 폐기 예방 리포트와 광고 없는 AI를 확인해요."
                  : "30·90일 폐기 예방 리포트와 광고 없는 AI를 살펴봐요."
            }
            icon={CreditCard}
            onPress={() => router.push("/settings/subscription")}
          />
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
            title="문의하기"
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
    color: colors.primaryForeground,
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
