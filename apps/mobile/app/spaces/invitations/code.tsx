import {
  formatSpaceInvitationCode,
  isValidSpaceInvitationCode,
  normalizeSpaceInvitationCode,
} from "@expirymate/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Bell, BellOff, KeyRound, LogIn } from "lucide-react-native";
import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "../../../src/components/Button";
import { EmptyState } from "../../../src/components/EmptyState";
import { Screen } from "../../../src/components/Screen";
import { useAuth } from "../../../src/features/auth/use-auth";
import {
  clearPendingSpaceInvitation,
  rememberPendingCodeInvitation,
} from "../../../src/features/spaces/pending-invitation";
import { useActiveSpace } from "../../../src/features/spaces/space-provider";
import {
  acceptSpaceInvitationCode,
  previewSpaceInvitationCode,
} from "../../../src/services/api";
import {
  colors,
  radius,
  spacing,
  touchTarget,
  typography,
} from "../../../src/shared/theme";

export default function AcceptSpaceInvitationCodeScreen() {
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const paramCode = firstParam(params.code);
  const queryClient = useQueryClient();
  const { isRegistered } = useAuth();
  const { setActiveSpaceId, refetchSpaces } = useActiveSpace();
  const [codeInput, setCodeInput] = useState(() =>
    formatSpaceInvitationCode(paramCode ?? ""),
  );
  const normalizedCode = normalizeSpaceInvitationCode(codeInput);
  const codeIsValid = isValidSpaceInvitationCode(normalizedCode);

  const previewMutation = useMutation({
    mutationFn: () => previewSpaceInvitationCode({ code: normalizedCode }),
  });
  const acceptMutation = useMutation({
    mutationFn: (notificationsEnabled: boolean) =>
      acceptSpaceInvitationCode({
        code: normalizedCode,
        notificationsEnabled,
      }),
    onSuccess: async (result) => {
      await clearPendingSpaceInvitation();
      await queryClient.invalidateQueries({ queryKey: ["inventory-spaces"] });
      await refetchSpaces();
      setActiveSpaceId(result.spaceId);
      router.replace("/(tabs)/inventory");
    },
    onError: () => {
      previewMutation.reset();
    },
  });

  useEffect(() => {
    if (!paramCode || !isValidSpaceInvitationCode(paramCode)) {
      return;
    }
    rememberPendingCodeInvitation(paramCode).catch(() => null);
  }, [paramCode]);

  const updateCode = (value: string) => {
    setCodeInput(formatSpaceInvitationCode(value));
    previewMutation.reset();
    acceptMutation.reset();
  };

  const rememberAndLogin = async () => {
    if (!codeIsValid) {
      return;
    }
    await rememberPendingCodeInvitation(normalizedCode);
    router.push("/auth/login");
  };

  const preview = async () => {
    if (!codeIsValid) {
      return;
    }
    await rememberPendingCodeInvitation(normalizedCode);
    previewMutation.mutate();
  };

  const previewData = previewMutation.data;

  return (
    <Screen
      contentWidth="form"
      title="초대 코드로 참여"
      subtitle="받은 8자리 코드로 가족이나 매장 냉장고에 함께할 수 있어요."
      footer={
        previewData ? undefined : (
          <Button
            icon={isRegistered ? KeyRound : LogIn}
            onPress={() => {
              void (isRegistered ? preview() : rememberAndLogin());
            }}
            disabled={!codeIsValid}
            loading={previewMutation.isPending}
            fullWidth
          >
            {isRegistered
              ? "어떤 냉장고인지 확인할게요"
              : "로그인하고 초대를 이어갈게요"}
          </Button>
        )
      }
    >
      {!previewData ? (
        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.label}>초대 코드</Text>
            <TextInput
              value={codeInput}
              onChangeText={updateCode}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={9}
              placeholder="ABCD-EFGH"
              placeholderTextColor={colors.mutedText}
              style={styles.codeInput}
              accessibilityLabel="8자리 초대 코드"
            />
            <Text style={styles.hint}>
              영문 대문자와 숫자 8자리를 입력해 주세요.
            </Text>
          </View>
          {previewMutation.error || acceptMutation.error ? (
            <Text style={styles.errorText}>
              {(previewMutation.error ?? acceptMutation.error) instanceof Error
                ? (previewMutation.error ?? acceptMutation.error)?.message
                : "초대 코드를 확인하지 못했어요."}
            </Text>
          ) : null}
        </View>
      ) : (
        <EmptyState
          mood="happy"
          title={`${previewData.spaceName}에 초대받았어요`}
          description={`${
            previewData.spaceType === "store" ? "매장" : "가족"
          } 냉장고의 재고를 구성원으로 함께 관리하게 돼요. ${formatExpiry(
            previewData.expiresAt,
          )}까지 참여할 수 있어요.`}
          accessory={
            <View style={styles.actionStack}>
              <Button
                icon={Bell}
                onPress={() => acceptMutation.mutate(true)}
                loading={acceptMutation.isPending}
                fullWidth
              >
                알림도 받고 함께할게요
              </Button>
              <Button
                icon={BellOff}
                variant="surface"
                onPress={() => acceptMutation.mutate(false)}
                disabled={acceptMutation.isPending}
                fullWidth
              >
                알림 없이 함께할게요
              </Button>
              <Button
                variant="secondary"
                onPress={() => previewMutation.reset()}
                disabled={acceptMutation.isPending}
                fullWidth
              >
                다른 코드를 입력할게요
              </Button>
            </View>
          }
        />
      )}
    </Screen>
  );
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatExpiry(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  codeInput: {
    minHeight: touchTarget.cta,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
    fontFamily: typography.heading.fontFamily,
    letterSpacing: 2,
    textAlign: "center",
    color: colors.text,
  },
  hint: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.subtext,
  },
  errorText: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.danger,
  },
  actionStack: {
    gap: spacing.sm,
  },
});
