import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Linking, View } from "react-native";
import { Button } from "../../src/components/Button";
import { EmptyState } from "../../src/components/EmptyState";
import type { MascotMood } from "../../src/components/Mascot";
import { Screen } from "../../src/components/Screen";
import { authQueryKey } from "../../src/features/auth/use-auth";
import { continuePendingSpaceInvitation } from "../../src/features/spaces/pending-invitation";
import { verifyEmail } from "../../src/services/api";
import { spacing } from "../../src/shared/theme";

function tokenFromParam(paramToken: string | string[] | undefined): string | null {
  const fromParam = Array.isArray(paramToken) ? paramToken[0] : paramToken;
  return fromParam?.trim() || null;
}

/** Supports `?token=` on both `expirymate://auth/...` and legacy `expirymate:///auth/...`. */
function tokenFromUrl(url: string | null): string | null {
  if (!url) {
    return null;
  }

  const match = url.match(/[?&]token=([^&]+)/);
  if (!match?.[1]) {
    return null;
  }

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/** Share one in-flight verify per token across Strict Mode remounts. */
const verifyInFlight = new Map<string, Promise<unknown>>();

export default function VerifyEmailScreen() {
  const { token: paramToken } = useLocalSearchParams<{ token?: string }>();
  const queryClient = useQueryClient();
  /** `undefined` while resolving deep-link token; `null` when missing. */
  const [token, setToken] = useState<string | null | undefined>(() =>
    tokenFromParam(paramToken) ?? undefined,
  );
  const [message, setMessage] = useState("메일함을 살펴보고 있어요.");
  const [isLoading, setIsLoading] = useState(true);
  const [mood, setMood] = useState<MascotMood>("idle");
  const [succeeded, setSucceeded] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const completedTokensRef = useRef(new Set<string>());

  useEffect(() => {
    const fromParam = tokenFromParam(paramToken);
    if (fromParam) {
      setToken(fromParam);
      return;
    }

    let cancelled = false;

    void Linking.getInitialURL().then((url) => {
      if (!cancelled) {
        setToken(tokenFromUrl(url));
      }
    });

    const subscription = Linking.addEventListener("url", ({ url }) => {
      const next = tokenFromUrl(url);
      if (next) {
        setToken(next);
      }
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [paramToken]);

  useEffect(() => {
    if (token === undefined) {
      return;
    }

    if (!token) {
      setMessage("인증 링크가 올바르지 않아요. 메일의 링크를 다시 살펴봐 주세요.");
      setMood("worry");
      setIsLoading(false);
      return;
    }

    if (completedTokensRef.current.has(token)) {
      setSucceeded(true);
      setMood("happy");
      setMessage("메일 확인이 끝났어요. 이제 함께 시작해요.");
      setIsLoading(false);
      void continuePendingSpaceInvitation().then((continued) => {
        if (!continued) {
          router.replace("/(tabs)/home");
        }
      });
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setMood("idle");
    setMessage("메일함을 살펴보고 있어요.");

    const cacheKey = `${token}:${retryCount}`;
    let pending = verifyInFlight.get(cacheKey);
    if (!pending) {
      pending = verifyEmail(token).finally(() => {
        verifyInFlight.delete(cacheKey);
      });
      verifyInFlight.set(cacheKey, pending);
    }

    void pending
      .then(async () => {
        completedTokensRef.current.add(token);
        await queryClient.invalidateQueries({ queryKey: authQueryKey });
        if (!(await continuePendingSpaceInvitation())) {
          router.replace("/(tabs)/home");
        }
        if (cancelled) {
          return;
        }
        setMessage("메일 확인이 끝났어요. 이제 함께 시작해요.");
        setMood("happy");
        setSucceeded(true);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setMessage(
          error instanceof Error
            ? error.message
            : "앗, 인증을 마치지 못했어요. 조금 뒤에 다시 해볼까요?",
        );
        setMood("worry");
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [queryClient, retryCount, token]);

  const title = isLoading
    ? "메일함을 살펴보고 있어요"
    : mood === "happy"
      ? "가입이 끝났어요"
      : "앗, 잠시 문제가 생겼어요";

  const isRateLimited = message.includes("너무 많");

  return (
    <Screen
      contentWidth="form"
      title="메일 확인"
      subtitle="장고가 메일을 같이 살펴볼게요."
      footer={
        isLoading ? undefined : (
          <View style={{ gap: spacing.sm }}>
            {succeeded ? (
              <Button
                onPress={() => {
                  void continuePendingSpaceInvitation().then((continued) => {
                    if (!continued) {
                      router.replace("/(tabs)/home");
                    }
                  });
                }}
                fullWidth
              >
                홈으로 갈게요
              </Button>
            ) : (
              <>
                <Button
                  onPress={() => setRetryCount((count) => count + 1)}
                  fullWidth
                >
                  {isRateLimited
                    ? "잠시 뒤 다시 확인할게요"
                    : "다시 확인할게요"}
                </Button>
                <Button
                  onPress={() => router.replace("/auth/verify-pending")}
                  fullWidth
                  variant="secondary"
                >
                  메일 확인 화면으로
                </Button>
              </>
            )}
          </View>
        )
      }
    >
      <EmptyState mood={mood} title={title} description={message} />
    </Screen>
  );
}
