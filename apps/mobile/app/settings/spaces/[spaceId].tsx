import type { InventorySpaceMember } from "@expirymate/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { router, Stack, useLocalSearchParams } from "expo-router";
import {
  Bell,
  Copy,
  KeyRound,
  MailPlus,
  Pencil,
  Share2,
  UserRound,
} from "lucide-react-native";
import { useState } from "react";
import { Share, StyleSheet, View } from "react-native";
import { AppText } from "../../../src/components/AppText";
import { AppTextInput } from "../../../src/components/AppTextInput";
import { BottomSheet } from "../../../src/components/BottomSheet";
import { Button } from "../../../src/components/Button";
import { EmptyState } from "../../../src/components/EmptyState";
import { ListRow } from "../../../src/components/ListRow";
import { Pill } from "../../../src/components/Pill";
import { SettingsGroup } from "../../../src/components/SettingsGroup";
import { SettingsScreen } from "../../../src/components/SettingsScreen";
import { useAuth } from "../../../src/features/auth/use-auth";
import { spacesListQueryKey } from "../../../src/features/auth/session-boundary";
import { spaceNotificationStatusCopy } from "../../../src/features/spaces/space-notification-copy";
import { useActiveSpace } from "../../../src/features/spaces/space-provider";
import { canInviteToSpace } from "../../../src/features/spaces/space-selection";
import { useSpaceManagement } from "../../../src/features/spaces/use-space-management";
import { useUpdateSpaceNotifications } from "../../../src/features/spaces/use-space-notifications";
import {
  deleteInventorySpace,
  updateInventorySpace,
} from "../../../src/services/api";
import {
  colors,
  radius,
  spacing,
  controlSize,
  typography,
} from "../../../src/shared/theme";

export default function SpaceDetailScreen() {
  const params = useLocalSearchParams<{ spaceId?: string | string[] }>();
  const spaceId = firstParam(params.spaceId);
  const queryClient = useQueryClient();
  const { sessionUserId } = useAuth();
  const { spaces, isLoading, refetchSpaces, setActiveSpaceId } =
    useActiveSpace();
  const space = spaces.find((item) => item.id === spaceId);
  const canManage = space?.myRole === "owner" || space?.myRole === "manager";
  const canInvite = canInviteToSpace(space);
  const isOwner = space?.myRole === "owner";
  const management = useSpaceManagement(spaceId, canManage);
  const [inviteVisible, setInviteVisible] = useState(false);
  const [inviteMethod, setInviteMethod] = useState<"email" | "code">("email");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"manager" | "member">("member");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const [renameVisible, setRenameVisible] = useState(false);
  const [spaceName, setSpaceName] = useState("");
  const [exitAction, setExitAction] = useState<"delete" | "leave" | null>(null);
  const [selectedMember, setSelectedMember] =
    useState<InventorySpaceMember | null>(null);
  const members = management.membersQuery.data ?? [];
  const invitations = management.invitationsQuery.data ?? [];
  const invitationCodes = management.invitationCodesQuery.data ?? [];

  const notificationsMutation = useUpdateSpaceNotifications();
  const deleteMutation = useMutation({
    mutationFn: () => deleteInventorySpace(spaceId as string),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: spacesListQueryKey(sessionUserId) });
      const result = await refetchSpaces();
      const personal = result.data?.find((item) => item.type === "personal");
      if (personal) {
        setActiveSpaceId(personal.id);
      }
      router.replace("/settings/spaces");
    },
  });
  const renameMutation = useMutation({
    mutationFn: () =>
      updateInventorySpace(spaceId as string, { name: spaceName.trim() }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: spacesListQueryKey(sessionUserId) });
      await refetchSpaces();
      setRenameVisible(false);
    },
  });

  const returnToPersonalSpace = async () => {
    await queryClient.invalidateQueries({ queryKey: spacesListQueryKey(sessionUserId) });
    const result = await refetchSpaces();
    const personal = result.data?.find((item) => item.type === "personal");
    if (personal) {
      setActiveSpaceId(personal.id);
    }
    router.replace("/settings/spaces");
  };

  if (!spaceId || !space) {
    if (spaceId && isLoading) {
      return (
        <SettingsScreen>
          <EmptyState
            kind="loading"
            mood="idle"
            title="냉장고를 펼치고 있어요"
            description="함께 쓰는 냉장고를 확인하고 있어요."
          />
        </SettingsScreen>
      );
    }

    return (
      <SettingsScreen>
        <EmptyState
          kind="error"
          mood="worry"
          title="이 냉장고를 다시 찾지 못했어요"
          description="함께 쓰는 냉장고 목록에서 다시 골라볼까요?"
          actionLabel="목록으로 이동"
          onAction={() => router.replace("/settings/spaces")}
        />
      </SettingsScreen>
    );
  }

  const submitInvite = () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      return;
    }
    management.inviteMutation.mutate(
      { email, role: inviteRole },
      {
        onSuccess: () => {
          setInviteVisible(false);
          setInviteEmail("");
          setInviteRole("member");
        },
      },
    );
  };

  const closeInviteSheet = () => {
    setInviteVisible(false);
    setGeneratedCode(null);
    setCopyStatus("");
    management.createCodeMutation.reset();
  };

  const createCode = () => {
    management.createCodeMutation.mutate(undefined, {
      onSuccess: (result) => {
        setGeneratedCode(result.code);
        setCopyStatus("");
      },
    });
  };

  const copyCode = async () => {
    if (!generatedCode) {
      return;
    }
    await Clipboard.setStringAsync(generatedCode);
    setCopyStatus("코드를 복사했어요.");
  };

  const shareCode = async () => {
    if (!generatedCode) {
      return;
    }
    await Share.share({
      message: `${space?.name ?? "함께 쓰는 냉장고"} 초대 코드: ${generatedCode}\n7일 안에 한 번 사용할 수 있어요.`,
    });
  };

  const closeMemberSheet = () => setSelectedMember(null);
  const changeRole = (role: "manager" | "member") => {
    if (!selectedMember) {
      return;
    }
    management.updateRoleMutation.mutate(
      { userId: selectedMember.userId, role },
      { onSuccess: closeMemberSheet },
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: space?.name ?? "함께 쓰는 냉장고" }} />
      <SettingsScreen
        footer={
          canInvite ? (
            <Button
              icon={MailPlus}
              onPress={() => setInviteVisible(true)}
              fullWidth
            >
              구성원 초대
            </Button>
          ) : undefined
        }
      >
      {management.membersQuery.isError ? (
        <EmptyState
          kind="error"
          mood="worry"
          title="구성원을 불러오지 못했어요"
          actionLabel="다시 시도"
          onAction={() => {
            void management.membersQuery.refetch();
          }}
        />
      ) : (
        <SettingsGroup title="구성원">
          {members.map((member, index) => (
            <ListRow
              key={member.userId}
              title={
                member.displayName?.trim() ||
                member.email ||
                "이름을 정하지 않은 구성원"
              }
              description={`${roleLabel(member.role)}${
                member.userId === sessionUserId ? " · 나" : ""
              }`}
              icon={UserRound}
              trailing={
                <AppText style={styles.roleText}>{roleLabel(member.role)}</AppText>
              }
              last={index === members.length - 1}
              onPress={
                member.role !== "owner" &&
                member.userId !== sessionUserId &&
                (isOwner ||
                  (space?.myRole === "manager" && member.role === "member"))
                  ? () => setSelectedMember(member)
                  : undefined
              }
            />
          ))}
        </SettingsGroup>
      )}

      {canInvite && invitations.length ? (
        <SettingsGroup title="초대를 기다리고 있어요">
          {invitations.map((invitation, index) => (
            <ListRow
              key={invitation.id}
              title={invitation.email}
              description={`${roleLabel(invitation.role)}로 초대했어요`}
              icon={MailPlus}
              destructive
              last={index === invitations.length - 1}
              onPress={() => management.revokeMutation.mutate(invitation.id)}
            />
          ))}
        </SettingsGroup>
      ) : null}

      {canInvite && invitationCodes.length ? (
        <SettingsGroup title="사용을 기다리는 초대 코드">
          {invitationCodes.map((invitation, index) => (
            <ListRow
              key={invitation.id}
              title="1회용 초대 코드"
              description={`${formatExpiry(invitation.expiresAt)}까지 · 구성원으로 참여`}
              icon={KeyRound}
              destructive
              last={index === invitationCodes.length - 1}
              onPress={() =>
                management.revokeCodeMutation.mutate(invitation.id)
              }
            />
          ))}
        </SettingsGroup>
      ) : null}

      <SettingsGroup title="이 냉장고 알림">
        <ListRow
          title={spaceNotificationStatusCopy(
            Boolean(space?.notificationsEnabled),
          )}
          description="내 기기에서 받을지 공간마다 고를 수 있어요."
          icon={Bell}
          last
          onPress={() =>
            spaceId &&
            notificationsMutation.mutate({
              spaceId,
              enabled: !space?.notificationsEnabled,
            })
          }
        />
      </SettingsGroup>

      {canManage ? (
        <SettingsGroup title="냉장고 설정">
          <ListRow
            title="이름을 바꿀게요"
            description={space?.name}
            icon={Pencil}
            last
            onPress={() => {
              setSpaceName(space?.name ?? "");
              setRenameVisible(true);
            }}
          />
        </SettingsGroup>
      ) : null}

      {isOwner && space.type !== "personal" ? (
        <Button
          variant="danger"
          onPress={() => {
            deleteMutation.reset();
            management.removeMutation.reset();
            setExitAction("delete");
          }}
          loading={deleteMutation.isPending}
          fullWidth
        >
          냉장고 삭제
        </Button>
      ) : null}
      {!isOwner && space.type !== "personal" && sessionUserId ? (
        <Button
          variant="danger"
          onPress={() => {
            deleteMutation.reset();
            management.removeMutation.reset();
            setExitAction("leave");
          }}
          loading={management.removeMutation.isPending}
          fullWidth
        >
          냉장고 나가기
        </Button>
      ) : null}

      <BottomSheet
        visible={inviteVisible}
        onClose={closeInviteSheet}
        title="누구와 함께 쓸까요?"
        description={
          inviteMethod === "email"
            ? "초대받을 분의 가입 이메일을 알려 주세요."
            : "7일 안에 한 명만 사용할 수 있는 코드를 만들어요."
        }
        footer={
          inviteMethod === "email" ? (
            <Button
              onPress={submitInvite}
              disabled={!inviteEmail.trim()}
              loading={management.inviteMutation.isPending}
              fullWidth
            >
              초대 메일 보내기
            </Button>
          ) : generatedCode ? (
            <Button
              icon={Share2}
              onPress={() => {
                void shareCode();
              }}
              fullWidth
            >
              코드 공유
            </Button>
          ) : (
            <Button
              icon={KeyRound}
              onPress={createCode}
              loading={management.createCodeMutation.isPending}
              fullWidth
            >
              1회용 코드 만들기
            </Button>
          )
        }
      >
        <View style={styles.pillRow}>
          <Pill
            label="이메일"
            selected={inviteMethod === "email"}
            onPress={() => {
              setInviteMethod("email");
              setGeneratedCode(null);
            }}
          />
          <Pill
            label="초대 코드"
            selected={inviteMethod === "code"}
            onPress={() => setInviteMethod("code")}
          />
        </View>
        {inviteMethod === "email" ? (
          <>
            <View style={styles.field}>
              <AppText style={styles.label}>이메일</AppText>
              <AppTextInput
                value={inviteEmail}
                onChangeText={setInviteEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="family@example.com"
                placeholderTextColor={colors.mutedText}
                style={styles.input}
              />
            </View>
            <View style={styles.field}>
              <AppText style={styles.label}>역할</AppText>
              <View style={styles.pillRow}>
                <Pill
                  label="구성원"
                  selected={inviteRole === "member"}
                  onPress={() => setInviteRole("member")}
                />
                {isOwner ? (
                  <Pill
                    label="관리자"
                    selected={inviteRole === "manager"}
                    onPress={() => setInviteRole("manager")}
                  />
                ) : null}
              </View>
            </View>
            {management.inviteMutation.error ? (
              <AppText style={styles.errorText}>
                {management.inviteMutation.error instanceof Error
                  ? management.inviteMutation.error.message
                  : "앗, 초대 메일을 보내지 못했어요."}
              </AppText>
            ) : null}
          </>
        ) : generatedCode ? (
          <View style={styles.codeCard}>
            <AppText style={styles.codeEyebrow}>지금만 확인할 수 있어요</AppText>
            <AppText style={styles.generatedCode} selectable>
              {generatedCode}
            </AppText>
            <AppText style={styles.codeDescription}>
              7일 안에 먼저 입력한 한 명이 구성원으로 참여해요. 닫으면 이 코드는
              다시 볼 수 없어요.
            </AppText>
            <View style={styles.codeActions}>
              <Button
                icon={Copy}
                variant="surface"
                size="small"
                onPress={() => {
                  void copyCode();
                }}
                style={styles.codeAction}
              >
                복사
              </Button>
              <AppText style={styles.copyStatus}>
                {copyStatus || "공유하거나 닫기 전에 복사해 두세요."}
              </AppText>
            </View>
          </View>
        ) : management.createCodeMutation.error ? (
          <AppText style={styles.errorText}>
            {management.createCodeMutation.error instanceof Error
              ? management.createCodeMutation.error.message
              : "앗, 초대 코드를 만들지 못했어요."}
          </AppText>
        ) : null}
      </BottomSheet>

      <BottomSheet
        visible={renameVisible}
        onClose={() => setRenameVisible(false)}
        title="냉장고 이름을 바꿀까요?"
        description="함께 쓰는 모든 구성원에게 새 이름으로 보여요."
        footer={
          <Button
            onPress={() => renameMutation.mutate()}
            disabled={!spaceName.trim()}
            loading={renameMutation.isPending}
            fullWidth
          >
            이름 변경
          </Button>
        }
      >
        <View style={styles.field}>
          <AppText style={styles.label}>냉장고 이름</AppText>
          <AppTextInput
            value={spaceName}
            onChangeText={setSpaceName}
            maxLength={40}
            placeholder="예: 우리 집 냉장고"
            placeholderTextColor={colors.mutedText}
            style={styles.input}
          />
        </View>
      </BottomSheet>

      <BottomSheet
        visible={Boolean(exitAction)}
        onClose={() => {
          setExitAction(null);
          deleteMutation.reset();
          management.removeMutation.reset();
        }}
        title={
          exitAction === "delete"
            ? "이 냉장고를 정말 정리할까요?"
            : "이 냉장고에서 나갈까요?"
        }
        description={
          exitAction === "delete"
            ? "공유 재고와 보관 위치, 추천 기록이 모두 사라지고 되돌릴 수 없어요."
            : "다시 초대받기 전까지 이 냉장고의 재고를 볼 수 없어요."
        }
        footer={
          <Button
            variant="danger"
            onPress={() => {
              if (exitAction === "delete") {
                deleteMutation.mutate();
                return;
              }
              if (!sessionUserId) {
                return;
              }
              management.removeMutation.mutate(sessionUserId, {
                onSuccess: () => {
                  void returnToPersonalSpace();
                },
              });
            }}
            loading={
              deleteMutation.isPending || management.removeMutation.isPending
            }
            fullWidth
          >
            {exitAction === "delete"
              ? "냉장고와 공유 데이터 삭제"
              : "공유 종료"}
          </Button>
        }
      >
        {exitAction === "delete" && deleteMutation.error ? (
          <AppText style={styles.errorText}>
            {deleteMutation.error instanceof Error
              ? deleteMutation.error.message
              : "앗, 지금 이 냉장고를 정리하지 못했어요."}
          </AppText>
        ) : null}
        {exitAction === "leave" && management.removeMutation.error ? (
          <AppText style={styles.errorText}>
            {management.removeMutation.error instanceof Error
              ? management.removeMutation.error.message
              : "앗, 지금 이 냉장고에서 나가지 못했어요."}
          </AppText>
        ) : null}
      </BottomSheet>

      <BottomSheet
        visible={Boolean(selectedMember)}
        onClose={closeMemberSheet}
        title={selectedMember?.displayName || selectedMember?.email || "구성원"}
        description="역할을 바꾸거나 함께 쓰기를 마칠 수 있어요."
      >
        {isOwner ? (
          <View style={styles.actionStack}>
            <Button
              variant="surface"
              onPress={() =>
                changeRole(
                  selectedMember?.role === "manager" ? "member" : "manager",
                )
              }
              loading={management.updateRoleMutation.isPending}
              fullWidth
            >
              {selectedMember?.role === "manager"
                ? "구성원으로 변경"
                : "관리자로 변경"}
            </Button>
            <Button
              variant="surface"
              onPress={() => {
                if (!selectedMember) {
                  return;
                }
                management.transferMutation.mutate(selectedMember.userId, {
                  onSuccess: closeMemberSheet,
                });
              }}
              loading={management.transferMutation.isPending}
              fullWidth
            >
              소유권 이전
            </Button>
          </View>
        ) : null}
        <Button
          variant="danger"
          onPress={() => {
            if (!selectedMember) {
              return;
            }
            management.removeMutation.mutate(selectedMember.userId, {
              onSuccess: closeMemberSheet,
            });
          }}
          loading={management.removeMutation.isPending}
          fullWidth
        >
          구성원 내보내기
        </Button>
      </BottomSheet>
    </SettingsScreen>
    </>
  );
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function roleLabel(role?: "owner" | "manager" | "member") {
  return role === "owner" ? "소유자" : role === "manager" ? "관리자" : "구성원";
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
  roleText: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.primaryForeground,
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
  actionStack: {
    gap: spacing.sm,
  },
  errorText: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.dangerForeground,
  },
  codeCard: {
    borderRadius: radius.xl,
    backgroundColor: colors.primarySoft,
    padding: spacing.md,
    gap: spacing.sm,
    alignItems: "center",
  },
  codeEyebrow: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.primaryForeground,
  },
  generatedCode: {
    fontSize: typography.title.fontSize,
    lineHeight: typography.title.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.text,
    letterSpacing: 2,
  },
  codeDescription: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.subtext,
    textAlign: "center",
  },
  codeActions: {
    alignSelf: "stretch",
    gap: spacing.xs,
  },
  codeAction: {
    alignSelf: "stretch",
  },
  copyStatus: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.subtext,
    textAlign: "center",
  },
});
