import { router } from "expo-router";
import { LogOut, Mail } from "lucide-react-native";
import { Alert, StyleSheet, View } from "react-native";
import { ListRow } from "../../src/components/ListRow";
import { Screen } from "../../src/components/Screen";
import { SectionHeader } from "../../src/components/SectionHeader";
import { useAuth } from "../../src/features/auth/use-auth";
import { getSettingsErrorMessage } from "../../src/features/settings/settings-format";
import { colors, radius, spacing } from "../../src/shared/theme";

export default function AccountSettingsScreen() {
  const auth = useAuth();
  const user = auth.query.data;
  const emailVerified = Boolean(user?.emailVerifiedAt);

  return (
    <Screen
      title="계정"
      subtitle="연결된 계정으로 재료를 안전하게 지킬 수 있어요."
    >
      <View style={styles.section}>
        <SectionHeader
          title="내 정보"
          description="지금 이 기기에서 쓰는 계정을 보여드릴게요."
        />
        <View style={styles.card}>
          <ListRow
            title="내 계정"
            description={`${user?.email ?? "연결된 계정"}${
              !emailVerified && user?.email ? " · 메일 확인이 필요해요" : ""
            }`}
            last={emailVerified || !user?.email}
          />
          {!emailVerified && user?.email ? (
            <ListRow
              title="인증 메일 다시 받을게요"
              description="메일함에서 인증만 마쳐 주세요."
              icon={Mail}
              last
              onPress={() =>
                auth.requestVerificationMutation.mutate(undefined, {
                  onSuccess: () =>
                    Alert.alert(
                      "메일을 보냈어요",
                      "메일함에서 인증만 마쳐 주세요. 장고가 기다리고 있어요.",
                    ),
                  onError: (error) =>
                    Alert.alert(
                      "앗, 잠시 문제가 생겼어요",
                      getSettingsErrorMessage(error),
                    ),
                })
              }
            />
          ) : null}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="이 기기에서"
          description="나가셔도 냉장고 기록은 계정에 남아 있어요."
        />
        <View style={styles.card}>
          <ListRow
            title="로그아웃"
            description="이 기기에서 잠시 나갈게요."
            icon={LogOut}
            last
            onPress={() =>
              auth.logoutMutation.mutate(undefined, {
                onSuccess: () => {
                  Alert.alert("다음에 또 만나요", "이 기기에서 나갔어요.");
                  router.replace("/auth/login");
                },
              })
            }
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
