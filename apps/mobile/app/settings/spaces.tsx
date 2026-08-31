import type { InventorySpaceType } from "@expirymate/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Building2, House, KeyRound, Plus, Users } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppText } from "../../src/components/AppText";
import { AppTextInput } from "../../src/components/AppTextInput";
import { BottomSheet } from "../../src/components/BottomSheet";
import { Button } from "../../src/components/Button";
import { EmptyState } from "../../src/components/EmptyState";
import { ListRow } from "../../src/components/ListRow";
import { Pill } from "../../src/components/Pill";
import { SettingsGroup } from "../../src/components/SettingsGroup";
import { SettingsScreen } from "../../src/components/SettingsScreen";
import { createInventorySpace } from "../../src/services/api";
import { spacesListQueryKey } from "../../src/features/auth/session-boundary";
import { useAuth } from "../../src/features/auth/use-auth";
import { useActiveSpace } from "../../src/features/spaces/space-provider";
import {
  colors,
  radius,
  spacing,
  controlSize,
  typography,
} from "../../src/shared/theme";

export default function SpacesSettingsScreen() {
  const queryClient = useQueryClient();
  const { sessionUserId } = useAuth();
  const {
    spaces,
    activeSpaceId,
    isLoading,
    error,
    setActiveSpaceId,
    refetchSpaces,
  } = useActiveSpace();
  const [createVisible, setCreateVisible] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] =
    useState<Exclude<InventorySpaceType, "personal">>("household");
  const createMutation = useMutation({
    mutationFn: createInventorySpace,
    onSuccess: async (space) => {
      await queryClient.invalidateQueries({
        queryKey: spacesListQueryKey(sessionUserId),
      });
      await refetchSpaces();
      setActiveSpaceId(space.id);
      setCreateVisible(false);
      setName("");
    },
  });

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    createMutation.mutate({ name: trimmed, type });
  };

  return (
    <SettingsScreen
      footer={
        <Button
          icon={Plus}
          onPress={() => setCreateVisible(true)}
          fullWidth
        >
          냉장고 만들기
        </Button>
      }
    >
      <SettingsGroup title="참여하기">
        <ListRow
          title="초대 코드로 참여"
          description="가족이나 매장 동료에게 받은 8자리 코드를 입력해요."
          icon={KeyRound}
          last
          onPress={() => router.push("/spaces/invitations/code")}
        />
      </SettingsGroup>

      {error ? (
        <EmptyState
          kind="error"
          mood="worry"
          title="냉장고 목록을 펼치지 못했어요"
          description={error.message}
          actionLabel="다시 시도"
          onAction={() => {
            void refetchSpaces();
          }}
        />
      ) : null}
      {!error && !isLoading ? (
        <SettingsGroup title="내 냉장고">
          {spaces.map((space, index) => {
            const Icon =
              space.type === "store"
                ? Building2
                : space.type === "household"
                  ? Users
                  : House;
            return (
              <ListRow
                key={space.id}
                title={space.name}
                description={`${space.memberCount}명이 함께 써요 · ${
                  space.id === activeSpaceId ? "지금 보는 중" : roleLabel(space.myRole)
                }`}
                icon={Icon}
                last={index === spaces.length - 1}
                onPress={() =>
                  router.push({
                    pathname: "/settings/spaces/[spaceId]",
                    params: { spaceId: space.id },
                  })
                }
              />
            );
          })}
        </SettingsGroup>
      ) : null}

      <BottomSheet
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        title="어떤 냉장고를 만들까요?"
        description="이름과 쓰임을 정하면 바로 구성원을 부를 수 있어요."
        footer={
          <Button
            onPress={submit}
            disabled={!name.trim()}
            loading={createMutation.isPending}
            fullWidth
          >
            냉장고 만들기
          </Button>
        }
      >
        <View style={styles.field}>
          <AppText style={styles.label}>냉장고 이름</AppText>
          <AppTextInput
            value={name}
            onChangeText={setName}
            placeholder="예: 우리 집 냉장고"
            placeholderTextColor={colors.mutedText}
            maxLength={40}
            style={styles.input}
          />
        </View>
        <View style={styles.field}>
          <AppText style={styles.label}>누구와 쓰나요?</AppText>
          <View style={styles.pillRow}>
            <Pill
              label="가족과 함께"
              selected={type === "household"}
              onPress={() => setType("household")}
            />
            <Pill
              label="매장에서 함께"
              selected={type === "store"}
              onPress={() => setType("store")}
            />
          </View>
        </View>
        {createMutation.error ? (
          <AppText style={styles.errorText}>
            {createMutation.error instanceof Error
              ? createMutation.error.message
              : "앗, 냉장고를 만들지 못했어요."}
          </AppText>
        ) : null}
      </BottomSheet>
    </SettingsScreen>
  );
}

function roleLabel(role: "owner" | "manager" | "member") {
  return role === "owner" ? "소유자" : role === "manager" ? "관리자" : "구성원";
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.xs,
  },
  label: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  input: {
    minHeight: controlSize.cta,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.body.fontFamily,
    color: colors.text,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  errorText: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.danger,
  },
});
