import { router } from "expo-router";
import { LogOut, Mail, Trash2 } from "lucide-react-native";
import { Alert } from "react-native";
import { ListRow } from "../../src/components/ListRow";
import { SettingsGroup } from "../../src/components/SettingsGroup";
import { SettingsScreen } from "../../src/components/SettingsScreen";
import { useAuth } from "../../src/features/auth/use-auth";
import { getSettingsErrorMessage } from "../../src/features/settings/settings-format";

export default function AccountSettingsScreen() {
  const auth = useAuth();
  const user = auth.query.data;
  const emailVerified = Boolean(user?.emailVerifiedAt);

  return (
    <SettingsScreen>
      <SettingsGroup title="내 정보">
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
      </SettingsGroup>

      <SettingsGroup title="이 기기에서">
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
      </SettingsGroup>

      <SettingsGroup title="계정 정리">
        <ListRow
          title="계정과 데이터 정리"
          description="개인 냉장고의 재료와 내 추천·알림·로그인 정보가 지워져요."
          icon={Trash2}
          destructive
          last
          onPress={() => router.push("/privacy/account-delete")}
        />
      </SettingsGroup>
    </SettingsScreen>
  );
}
