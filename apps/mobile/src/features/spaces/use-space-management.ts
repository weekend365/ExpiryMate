import type {
  InviteSpaceMemberBody,
  UpdateSpaceMemberBody,
} from "@expirymate/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createSpaceInvitationCode,
  inviteSpaceMember,
  listSpaceInvitationCodes,
  listSpaceInvitations,
  listSpaceMembers,
  removeSpaceMember,
  revokeSpaceInvitation,
  revokeSpaceInvitationCode,
  transferSpaceOwnership,
  updateSpaceMember,
} from "../../services/api";
import { useAuth } from "../auth/use-auth";

export const spaceMembersQueryKey = (userId: string, spaceId: string) =>
  ["inventory-space-members", userId, spaceId] as const;
export const spaceInvitationsQueryKey = (userId: string, spaceId: string) =>
  ["inventory-space-invitations", userId, spaceId] as const;
export const spaceInvitationCodesQueryKey = (
  userId: string,
  spaceId: string,
) => ["inventory-space-invitation-codes", userId, spaceId] as const;

export function useSpaceManagement(
  spaceId: string | undefined,
  canManage = true,
) {
  const queryClient = useQueryClient();
  const { sessionUserId } = useAuth();
  const userKey = sessionUserId ?? "signed-out";
  const membersQuery = useQuery({
    queryKey: spaceMembersQueryKey(userKey, spaceId ?? ""),
    queryFn: () => listSpaceMembers(spaceId as string),
    enabled: Boolean(spaceId),
  });
  const invitationsQuery = useQuery({
    queryKey: spaceInvitationsQueryKey(userKey, spaceId ?? ""),
    queryFn: () => listSpaceInvitations(spaceId as string),
    enabled: Boolean(spaceId && canManage),
  });
  const invitationCodesQuery = useQuery({
    queryKey: spaceInvitationCodesQueryKey(userKey, spaceId ?? ""),
    queryFn: () => listSpaceInvitationCodes(spaceId as string),
    enabled: Boolean(spaceId && canManage),
  });

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: spaceMembersQueryKey(userKey, spaceId ?? ""),
      }),
      queryClient.invalidateQueries({
        queryKey: spaceInvitationsQueryKey(userKey, spaceId ?? ""),
      }),
      queryClient.invalidateQueries({
        queryKey: spaceInvitationCodesQueryKey(userKey, spaceId ?? ""),
      }),
      queryClient.invalidateQueries({ queryKey: ["inventory-spaces"] }),
    ]);

  const inviteMutation = useMutation({
    mutationFn: (payload: InviteSpaceMemberBody) =>
      inviteSpaceMember(spaceId as string, payload),
    onSuccess: invalidate,
  });
  const updateRoleMutation = useMutation({
    mutationFn: ({
      userId,
      role,
    }: {
      userId: string;
      role: UpdateSpaceMemberBody["role"];
    }) => updateSpaceMember(spaceId as string, userId, { role }),
    onSuccess: invalidate,
  });
  const removeMutation = useMutation({
    mutationFn: (userId: string) =>
      removeSpaceMember(spaceId as string, userId),
    onSuccess: invalidate,
  });
  const transferMutation = useMutation({
    mutationFn: (userId: string) =>
      transferSpaceOwnership(spaceId as string, userId),
    onSuccess: invalidate,
  });
  const revokeMutation = useMutation({
    mutationFn: (invitationId: string) =>
      revokeSpaceInvitation(spaceId as string, invitationId),
    onSuccess: invalidate,
  });
  const createCodeMutation = useMutation({
    mutationFn: () => createSpaceInvitationCode(spaceId as string),
    onSuccess: invalidate,
  });
  const revokeCodeMutation = useMutation({
    mutationFn: (invitationId: string) =>
      revokeSpaceInvitationCode(spaceId as string, invitationId),
    onSuccess: invalidate,
  });

  return {
    membersQuery,
    invitationsQuery,
    invitationCodesQuery,
    inviteMutation,
    updateRoleMutation,
    removeMutation,
    transferMutation,
    revokeMutation,
    createCodeMutation,
    revokeCodeMutation,
  };
}
