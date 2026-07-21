import { appBrand } from "@expirymate/shared";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import { ChevronRight, ExternalLink, ShieldCheck, Trash2 } from "lucide-react-native";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Mascot } from "../../src/components/Mascot";
import { Screen } from "../../src/components/Screen";
import { SectionHeader } from "../../src/components/SectionHeader";
import { usePrivacyStatus } from "../../src/features/privacy/use-privacy";
import {
  colors,
  radius,
  spacing,
  touchTarget,
  typography,
} from "../../src/shared/theme";

export default function PrivacyScreen() {
  const privacyStatusQuery = usePrivacyStatus();
  const status = privacyStatusQuery.data;

  const openPolicy = () => {
    if (!status?.privacyPolicyUrl) {
      Alert.alert(
        "조금만 기다려 주세요",
        "개인정보 안내를 아직 불러오는 중이에요.",
      );
      return;
    }

    WebBrowser.openBrowserAsync(status.privacyPolicyUrl).catch(() =>
      Alert.alert(
        "앗, 잠시 문제가 생겼어요",
        "개인정보 안내를 열지 못했어요. 조금 뒤에 다시 해볼까요?",
      ),
    );
  };

  return (
    <Screen
      title="개인정보와 추천 안내"
      subtitle={`${appBrand.appNameKo}가 어떤 정보를 쓰는지, 어떻게 지울 수 있는지 같이 볼게요.`}
    >
      <View style={styles.hero}>
        <Mascot size="small" mood="idle" />
        <Text style={styles.heroText}>
          궁금한 것만 골라 보시면 돼요. {appBrand.characterNameKo}가 옆에서
          도와드릴게요.
        </Text>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="살펴보기"
          description="짧게 읽고, 필요할 때만 더 열어보세요."
        />
        <View style={styles.card}>
          <PrivacyRow
            icon={ExternalLink}
            title="개인정보 다루는 방법"
            description={`${appBrand.appNameKo}는 계정, 넣은 재료와 유통기한, 알림 설정, 그동안 받은 요리 추천을 서비스를 위해 써요.`}
            onPress={openPolicy}
          />
          <PrivacyRow
            icon={ShieldCheck}
            title="요리 추천 안내"
            description="요리 추천을 부탁하면, 보관 중인 재료 일부와 고른 조건이 장고 서버를 거쳐 외부 요리 도우미로 전달돼요. 첫 추천 전에 한 번만 살펴봐 주세요."
            onPress={() => router.push("/privacy/ai-data-notice")}
            last
          />
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="계정 정리"
          description="떠나실 때도 데이터를 직접 지우실 수 있어요."
        />
        <View style={styles.card}>
          <PrivacyRow
            icon={Trash2}
            title="계정과 데이터 정리"
            description="넣은 재료, 받은 추천, 알림 설정, 로그인 기록과 연결된 계정 정보가 바로 지워져요."
            tone="danger"
            onPress={() => router.push("/privacy/account-delete")}
            last
          />
        </View>
      </View>

      {status?.contactEmail ? (
        <Text style={styles.footerText}>문의: {status.contactEmail}</Text>
      ) : null}
    </Screen>
  );
}

function PrivacyRow({
  icon: Icon,
  title,
  description,
  onPress,
  tone = "default",
  last = false,
}: {
  icon: typeof ExternalLink;
  title: string;
  description: string;
  onPress: () => void;
  tone?: "default" | "danger";
  last?: boolean;
}) {
  const iconColor = tone === "danger" ? colors.danger : colors.primary;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        last && styles.rowLast,
        pressed && styles.rowPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={description}
    >
      <View
        style={[
          styles.rowIcon,
          tone === "danger" ? styles.rowIconDanger : styles.rowIconDefault,
        ]}
      >
        <Icon color={iconColor} size={spacing.sm} strokeWidth={2.4} />
      </View>
      <View style={styles.rowCopy}>
        <Text
          style={[
            styles.rowTitle,
            tone === "danger" ? styles.rowTitleDanger : null,
          ]}
        >
          {title}
        </Text>
        <Text style={styles.rowDescription}>{description}</Text>
      </View>
      <ChevronRight color={colors.mutedText} size={20} strokeWidth={2.2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.xxl,
    padding: spacing.md,
  },
  heroText: {
    flex: 1,
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
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
  row: {
    minHeight: touchTarget.min,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowPressed: {
    backgroundColor: colors.background,
  },
  rowIcon: {
    width: touchTarget.icon,
    height: touchTarget.icon,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  rowIconDefault: {
    backgroundColor: colors.primarySoft,
  },
  rowIconDanger: {
    backgroundColor: colors.dangerSoft,
  },
  rowCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  rowTitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.text,
  },
  rowTitleDanger: {
    color: colors.danger,
  },
  rowDescription: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.caption.fontFamily,
    color: colors.subtext,
  },
  footerText: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: typography.caption.fontFamily,
    color: colors.mutedText,
    textAlign: "center",
  },
});
