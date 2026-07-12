import { useLocalSearchParams, router } from "expo-router";
import { useEffect, useState } from "react";
import { Button } from "../../src/components/Button";
import { EmptyState } from "../../src/components/EmptyState";
import type { MascotMood } from "../../src/components/Mascot";
import { Screen } from "../../src/components/Screen";
import { verifyEmail } from "../../src/services/api";

export default function VerifyEmailScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [message, setMessage] = useState("메일함을 살펴보고 있어요.");
  const [isLoading, setIsLoading] = useState(true);
  const [mood, setMood] = useState<MascotMood>("idle");

  useEffect(() => {
    if (!token) {
      setMessage("인증 링크가 올바르지 않아요. 메일의 링크를 다시 살펴봐 주세요.");
      setMood("worry");
      setIsLoading(false);
      return;
    }

    verifyEmail(token)
      .then(() => {
        setMessage("메일 확인이 끝났어요. 이제 안심하고 쓸 수 있어요.");
        setMood("happy");
      })
      .catch((error: unknown) => {
        setMessage(
          error instanceof Error
            ? error.message
            : "앗, 인증을 마치지 못했어요. 조금 뒤에 다시 해볼까요?",
        );
        setMood("worry");
      })
      .finally(() => setIsLoading(false));
  }, [token]);

  const title = isLoading
    ? "메일함을 살펴보고 있어요"
    : mood === "happy"
      ? "인증을 마쳤어요"
      : "앗, 잠시 문제가 생겼어요";

  return (
    <Screen
      title="메일 확인"
      subtitle="장고가 메일을 같이 살펴볼게요."
      footer={
        isLoading ? undefined : (
          <Button onPress={() => router.replace("/(tabs)/settings")} fullWidth>
            설정으로 갈게요
          </Button>
        )
      }
    >
      <EmptyState mood={mood} title={title} description={message} />
    </Screen>
  );
}
