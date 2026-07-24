import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Bell, BellOff, LogIn } from "lucide-react-native";
import { useEffect } from "react";
import { Button } from "../../../src/components/Button";
import { EmptyState } from "../../../src/components/EmptyState";
import { Screen } from "../../../src/components/Screen";
import { useAuth } from "../../../src/features/auth/use-auth";
import {
  clearPendingSpaceInvitation,
  rememberPendingSpaceInvitation,
} from "../../../src/features/spaces/pending-invitation";
import { useActiveSpace } from "../../../src/features/spaces/space-provider";
import { acceptSpaceInvitation } from "../../../src/services/api";

export default function AcceptSpaceInvitationScreen() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = firstParam(params.token);
  const queryClient = useQueryClient();
  const { isRegistered } = useAuth();
  const { setActiveSpaceId, refetchSpaces } = useActiveSpace();
  const mutation = useMutation({
    mutationFn: (notificationsEnabled: boolean) =>
      acceptSpaceInvitation({
        token: token as string,
        notificationsEnabled,
      }),
    onSuccess: async (result) => {
      await clearPendingSpaceInvitation();
      await queryClient.invalidateQueries({ queryKey: ["inventory-spaces"] });
      await refetchSpaces();
      setActiveSpaceId(result.spaceId);
      router.replace("/(tabs)/inventory");
    },
  });

  useEffect(() => {
    if (token) {
      rememberPendingSpaceInvitation(token).catch(() => null);
    }
  }, [token]);

  if (!token) {
    return (
      <Screen>
        <EmptyState
          mood="worry"
          title="초대 링크를 다시 확인해 주세요"
          description="링크가 잘렸다면 초대한 분에게 새 메일을 부탁해 주세요."
        />
      </Screen>
    );
  }

  if (!isRegistered) {
    return (
      <Screen
        footer={
          <Button
            icon={LogIn}
            onPress={() => router.push("/auth/login")}
            fullWidth
          >
            로그인하고 초대를 이어갈게요
          </Button>
        }
      >
        <EmptyState
          mood="happy"
          title="함께 쓸 냉장고에 초대받았어요"
          description="초대받은 이메일 계정으로 로그인하면 바로 이어갈 수 있어요."
        />
      </Screen>
    );
  }

  return (
    <Screen
      title="함께 쓸 준비가 됐어요"
      subtitle="유통기한 알림을 받을지도 지금 고를 수 있어요."
    >
      <EmptyState
        mood={mutation.isSuccess ? "happy" : "idle"}
        title={
          mutation.isPending
            ? "초대를 이어가고 있어요"
            : "이 냉장고의 재고를 함께 볼까요?"
        }
        description={
          mutation.error instanceof Error
            ? mutation.error.message
            : "합류하면 구성원들과 같은 재고를 등록하고 정리할 수 있어요."
        }
        accessory={
          <>
            <Button
              icon={Bell}
              onPress={() => mutation.mutate(true)}
              loading={mutation.isPending}
              fullWidth
            >
              알림도 받고 함께할게요
            </Button>
            <Button
              icon={BellOff}
              variant="surface"
              onPress={() => mutation.mutate(false)}
              disabled={mutation.isPending}
              fullWidth
            >
              알림 없이 함께할게요
            </Button>
          </>
        }
      />
    </Screen>
  );
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
