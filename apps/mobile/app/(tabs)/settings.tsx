import { appBrand } from "@expirymate/shared";
import { router } from "expo-router";
import {
  Bell,
  CreditCard,
  MapPin,
  MessageCircleHeart,
  ShieldCheck,
  UserRound,
} from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { ListRow } from "../../src/components/ListRow";
import { Mascot } from "../../src/components/Mascot";
import { Screen } from "../../src/components/Screen";
import { SectionHeader } from "../../src/components/SectionHeader";
import { colors, radius, spacing, typography } from "../../src/shared/theme";

export default function SettingsScreen() {
  return (
    <Screen>
      <View style={styles.brandCard}>
        <Mascot size="small" mood="idle" />
        <View style={styles.brandCopy}>
          <Text style={styles.brandName}>{appBrand.appNameKo}</Text>
          <Text style={styles.brandMeta}>
            {appBrand.appNameEn} · {appBrand.productLineKo}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="맞춰볼까요?"
          description="한 번에 하나만, 장고랑 같이 정리해 볼게요."
        />
        <View style={styles.card}>
          <ListRow
            title="알림"
            description="유통기한 알림 시점과 켜고 끄기를 맞춰요."
            icon={Bell}
            onPress={() => router.push("/settings/notifications")}
          />
          <ListRow
            title="보관 위치"
            description="냉장·냉동 외에 나만의 자리를 추가해요."
            icon={MapPin}
            onPress={() => router.push("/settings/storage-locations")}
          />
          <ListRow
            title="계정"
            description="내 계정 확인, 인증 메일, 로그아웃을 살펴봐요."
            icon={UserRound}
            onPress={() => router.push("/settings/account")}
          />
          <ListRow
            title="구독"
            description="추천 한도와 구독 상태를 확인할 수 있어요."
            icon={CreditCard}
            onPress={() => router.push("/settings/subscription")}
          />
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
  brandCopy: {
    flex: 1,
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
