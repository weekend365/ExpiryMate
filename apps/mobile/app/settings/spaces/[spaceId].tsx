import type { InventorySpaceMember } from "@expirymate/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Bell, MailPlus, Pencil, UserRound } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { BottomSheet } from "../../../src/components/BottomSheet";
import { Button } from "../../../src/components/Button";
import { EmptyState } from "../../../src/components/EmptyState";
import { ListRow } from "../../../src/components/ListRow";
import { Pill } from "../../../src/components/Pill";
import { Screen } from "../../../src/components/Screen";
import { useAuth } from "../../../src/features/auth/use-auth";
import { useActiveSpace } from "../../../src/features/spaces/space-provider";
import { useSpaceManagement } from "../../../src/features/spaces/use-space-management";
import {
  deleteInventorySpace,
  updateInventorySpace,
  updateSpaceNotifications,
} from "../../../src/services/api";
import {
  colors,
  radius,
  spacing,
  touchTarget,
  typography,
} from "../../../src/shared/theme";

export default function SpaceDetailScreen() {
  const params = useLocalSearchParams<{ spaceId?: string | string[] }>();
  const spaceId = firstParam(params.spaceId);
  const queryClient = useQueryClient();
  const { sessionUserId } = useAuth();
  const { spaces, refetchSpaces, setActiveSpaceId } = useActiveSpace();
  const space = spaces.find((item) => item.id === spaceId);
  const canManage = space?.myRole === "owner" || space?.myRole === "manager";
  const isOwner = space?.myRole === "owner";
  const management = useSpaceManagement(spaceId, canManage);
  const [inviteVisible, setInviteVisible] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"manager" | "member">("member");
  const [renameVisible, setRenameVisible] = useState(false);
  const [spaceName, setSpaceName] = useState("");
  const [exitAction, setExitAction] = useState<"delete" | "leave" | null>(null);
  const [selectedMember, setSelectedMember] =
    useState<InventorySpaceMember | null>(null);
  const members = management.membersQuery.data ?? [];
  const invitations = management.invitationsQuery.data ?? [];

  const notificationsMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      updateSpaceNotifications(spaceId as string, enabled),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["inventory-spaces"] });
      void refetchSpaces();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteInventorySpace(spaceId as string),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["inventory-spaces"] });
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
      await queryClient.invalidateQueries({ queryKey: ["inventory-spaces"] });
      await refetchSpaces();
      setRenameVisible(false);
    },
  });

  const returnToPersonalSpace = async () => {
    await queryClient.invalidateQueries({ queryKey: ["inventory-spaces"] });
    const result = await refetchSpaces();
    const personal = result.data?.find((item) => item.type === "personal");
    if (personal) {
      setActiveSpaceId(personal.id);
    }
    router.replace("/settings/spaces");
  };

  if (!spaceId || (!space && !spaces.length)) {
    return (
      <Screen>
        <EmptyState
          mood="worry"
          title="이 냉장고를 다시 찾지 못했어요"
          description="함께 쓰는 냉장고 목록에서 다시 골라볼까요?"
          actionLabel="목록으로 돌아갈게요"
          onAction={() => router.replace("/settings/spaces")}
        />
      </Screen>
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
    <Screen
      title={space?.name ?? "함께 쓰는 냉장고"}
      subtitle={`${roleLabel(space?.myRole)}로 함께 쓰고 있어요.`}
      footer={
        canManage ? (
          <Button
            icon={MailPlus}
            onPress={() => setInviteVisible(true)}
            fullWidth
          >
            구성원을 초대할게요
          </Button>
        ) : undefined
      }
    >
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>구성원</Text>
        {management.membersQuery.isError ? (
          <EmptyState
            mood="worry"
            title="구성원을 불러오지 못했어요"
            actionLabel="다시 볼게요"
            onAction={() => {
              void management.membersQuery.refetch();
            }}
          />
        ) : (
          <View style={styles.card}>
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
                  <Text style={styles.roleText}>{roleLabel(member.role)}</Text>
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
          </View>
        )}
      </View>

      {canManage && invitations.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>초대를 기다리고 있어요</Text>
          <View style={styles.card}>
            {invitations.map((invitation, index) => (
              <ListRow
                key={invitation.id}
                title={invitation.email}
                description={`${roleLabel(invitation.role)}로 초대했어요`}
                icon={MailPlus}
                destructive
                last={index === invitations.length - 1}
                onPress={() =>
                  management.revokeMutation.mutate(invitation.id)
                }
              />
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>이 냉장고 알림</Text>
        <View style={styles.card}>
          <ListRow
            title={
              space?.notificationsEnabled
                ? "유통기한 알림을 받고 있어요"
                : "유통기한 알림은 쉬고 있어요"
            }
            description="내 기기에서 받을지 공간마다 고를 수 있어요."
            icon={Bell}
            last
            onPress={() =>
              notificationsMutation.mutate(!space?.notificationsEnabled)
            }
          />
        </View>
      </View>

      {canManage ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>냉장고 설정</Text>
          <View style={styles.card}>
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
          </View>
        </View>
      ) : null}

      {isOwner && space?.type !== "personal" ? (
        <Button
          variant="danger"
          onPress={() => setExitAction("delete")}
          loading={deleteMutation.isPending}
          fullWidth
        >
          이 냉장고를 정리할게요
        </Button>
      ) : null}
      {!isOwner && space?.type !== "personal" && sessionUserId ? (
        <Button
          variant="danger"
          onPress={() => setExitAction("leave")}
          loading={management.removeMutation.isPending}
          fullWidth
        >
          이 냉장고에서 나갈게요
        </Button>
      ) : null}

      <BottomSheet
        visible={inviteVisible}
        onClose={() => setInviteVisible(false)}
        title="누구와 함께 쓸까요?"
        description="초대받을 분의 가입 이메일을 알려 주세요."
        footer={
          <Button
            onPress={submitInvite}
            disabled={!inviteEmail.trim()}
            loading={management.inviteMutation.isPending}
            fullWidth
          >
            초대 메일을 보낼게요
          </Button>
        }
      >
        <View style={styles.field}>
          <Text style={styles.label}>이메일</Text>
          <TextInput
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
          <Text style={styles.label}>역할</Text>
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
          <Text style={styles.errorText}>
            {management.inviteMutation.error instanceof Error
              ? management.inviteMutation.error.message
              : "앗, 초대 메일을 보내지 못했어요."}
          </Text>
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
            이 이름으로 바꿀게요
          </Button>
        }
      >
        <View style={styles.field}>
          <Text style={styles.label}>냉장고 이름</Text>
          <TextInput
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
        onClose={() => setExitAction(null)}
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
              ? "냉장고와 공유 데이터를 지울게요"
              : "함께 쓰기를 마칠게요"}
          </Button>
        }
      />

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
                ? "구성원으로 바꿀게요"
                : "관리자로 맡길게요"}
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
              소유권을 넘길게요
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
          이 구성원과 함께 쓰기를 마칠게요
        </Button>
      </BottomSheet>
    </Screen>
  );
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function roleLabel(role?: "owner" | "manager" | "member") {
  return role === "owner" ? "소유자" : role === "manager" ? "관리자" : "구성원";
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.subheading.fontSize,
    lineHeight: typography.subheading.lineHeight,
    fontFamily: typography.subheading.fontFamily,
    color: colors.text,
  },
  card: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  roleText: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.primary,
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
    minHeight: touchTarget.cta,
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
    color: colors.danger,
  },
});
