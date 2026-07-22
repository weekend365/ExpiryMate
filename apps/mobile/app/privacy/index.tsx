import { appBrand } from "@expirymate/shared";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import {
  ChevronRight,
  ExternalLink,
  History,
  ShieldCheck,
  Trash2,
} from "lucide-react-native";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { BottomSheet } from "../../src/components/BottomSheet";
import { Button } from "../../src/components/Button";
import { Mascot } from "../../src/components/Mascot";
import { Screen } from "../../src/components/Screen";
import { SectionHeader } from "../../src/components/SectionHeader";
import {
  useDeleteRecommendationHistory,
  usePrivacyStatus,
} from "../../src/features/privacy/use-privacy";
import {
  colors,
  radius,
  spacing,
  touchTarget,
  typography,
} from "../../src/shared/theme";

export default function PrivacyScreen() {
  const privacyStatusQuery = usePrivacyStatus();
  const deleteHistoryMutation = useDeleteRecommendationHistory();
  const status = privacyStatusQuery.data;
  const historyCount = status?.recommendationHistoryCount ?? 0;
  const [historySheetOpen, setHistorySheetOpen] = useState(false);

  const openUrl = (url: string | undefined, label: string) => {
    if (!url) {
      Alert.alert(
        "조금만 기다려 주세요",
        `아직 ${label}를 불러오는 중이에요.`,
      );
      return;
    }

    WebBrowser.openBrowserAsync(url).catch(() =>
      Alert.alert(
        "앗, 잠시 문제가 생겼어요",
        `${label}를 열지 못했어요. 조금 뒤에 다시 해볼까요?`,
      ),
    );
  };

  const handleDeleteHistory = () => {
    deleteHistoryMutation.mutate(undefined, {
      onSuccess: (response) => {
        setHistorySheetOpen(false);
        Alert.alert(
          "추천 기록을 정리했어요",
          response.deletedCount > 0
            ? "그동안 받아 두신 요리 추천을 지웠어요."
            : "지울 추천 기록이 없어요.",
        );
      },
      onError: (error) => {
        setHistorySheetOpen(false);
        Alert.alert("앗, 잠시 문제가 생겼어요", getErrorMessage(error));
      },
    });
  };

  return (
    <>
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
              onPress={() => openUrl(status?.privacyPolicyUrl, "개인정보 안내")}
            />
            <PrivacyRow
              icon={ExternalLink}
              title="데이터 삭제·동의 철회 안내"
              description="앱에서 동의 철회, 추천 기록 정리, 계정 정리를 하는 방법을 웹에서도 볼 수 있어요."
              onPress={() =>
                openUrl(status?.privacyChoicesUrl, "데이터 삭제 안내")
              }
            />
            <PrivacyRow
              icon={ShieldCheck}
              title="요리 추천 안내"
              description="요리 추천을 부탁하면, 보관 중인 재료 일부와 고른 조건이 장고 서버를 거쳐 외부 요리 도우미로 전달돼요. 동의는 언제든 거둘 수 있어요."
              onPress={() => router.push("/privacy/ai-data-notice")}
              last
            />
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader
            title="추천 기록"
            description="계정은 두고, 받은 추천만 지울 수 있어요."
          />
          <View style={styles.card}>
            <PrivacyRow
              icon={History}
              title="받은 추천 기록 정리"
              description={
                historyCount > 0
                  ? `지금 ${historyCount}건의 추천이 남아 있어요. 정리하면 바로 지워져요.`
                  : "지금은 지울 추천 기록이 없어요."
              }
              tone="danger"
              onPress={() => {
                if (historyCount <= 0) {
                  Alert.alert(
                    "정리할 기록이 없어요",
                    "아직 받아 두신 요리 추천이 없어요.",
                  );
                  return;
                }
                setHistorySheetOpen(true);
              }}
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

      <BottomSheet
        visible={historySheetOpen}
        onClose={() => setHistorySheetOpen(false)}
        mascotMood="worry"
        title="받은 추천을 정리할까요?"
        description="그동안 받아 두신 요리 추천 기록이 사라져요. 계정과 재료는 그대로 두어요."
        footer={
          <View style={styles.sheetFooter}>
            <Button
              variant="secondary"
              onPress={() => setHistorySheetOpen(false)}
              fullWidth
            >
              조금 더 생각해 볼게요
            </Button>
            <Button
              variant="danger"
              onPress={handleDeleteHistory}
              loading={deleteHistoryMutation.isPending}
              fullWidth
            >
              추천 기록을 정리할게요
            </Button>
          </View>
        }
      />
    </>
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

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?";
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
  sheetFooter: {
    gap: spacing.sm,
  },
});
