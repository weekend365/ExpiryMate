import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { InventorySpaceRole, InventorySpaceType } from "@prisma/client";
import {
  type AcceptSpaceInvitationBody,
  type CreateInventorySpaceBody,
  type InventorySpaceMember,
  type InventorySpaceRole as SharedInventorySpaceRole,
  type InventorySpaceSummary,
  type InviteSpaceMemberBody,
  type SpaceInvitation,
  type UpdateInventorySpaceBody,
} from "@expirymate/shared";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../../database/prisma.service";
import { MailService } from "../auth/mail.service";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PERSONAL_SPACE_PREFIX = "personal_";

@Injectable()
export class SpacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async ensurePersonalSpace(userId: string) {
    const id = `${PERSONAL_SPACE_PREFIX}${userId}`;
    await this.prisma.$transaction(async (tx) => {
      await tx.inventorySpace.upsert({
        where: { id },
        create: {
          id,
          name: "내 냉장고",
          type: InventorySpaceType.personal,
          ownerUserId: userId,
        },
        update: {},
      });
      await tx.inventorySpaceMembership.upsert({
        where: { spaceId_userId: { spaceId: id, userId } },
        create: {
          spaceId: id,
          userId,
          role: InventorySpaceRole.owner,
          notificationsEnabled: true,
        },
        update: { role: InventorySpaceRole.owner },
      });
    });
    return id;
  }

  async getPersonalSpaceId(userId: string) {
    return this.ensurePersonalSpace(userId);
  }

  async listSpaces(userId: string): Promise<InventorySpaceSummary[]> {
    await this.ensurePersonalSpace(userId);
    const memberships = await this.prisma.inventorySpaceMembership.findMany({
      where: { userId },
      include: {
        space: {
          include: {
            _count: { select: { memberships: true } },
          },
        },
      },
      orderBy: [{ space: { type: "asc" } }, { joinedAt: "asc" }],
    });

    return memberships.map((membership) => ({
      id: membership.space.id,
      name: membership.space.name,
      type: membership.space.type,
      myRole: membership.role,
      notificationsEnabled: membership.notificationsEnabled,
      memberCount: membership.space._count.memberships,
      createdAt: membership.space.createdAt.toISOString(),
      updatedAt: membership.space.updatedAt.toISOString(),
    }));
  }

  async createSpace(userId: string, body: CreateInventorySpaceBody) {
    const space = await this.prisma.inventorySpace.create({
      data: {
        name: body.name,
        type: body.type as InventorySpaceType,
        ownerUserId: userId,
        memberships: {
          create: {
            userId,
            role: InventorySpaceRole.owner,
            notificationsEnabled: true,
          },
        },
      },
      include: { _count: { select: { memberships: true } } },
    });

    return {
      id: space.id,
      name: space.name,
      type: space.type,
      myRole: InventorySpaceRole.owner,
      notificationsEnabled: true,
      memberCount: space._count.memberships,
      createdAt: space.createdAt.toISOString(),
      updatedAt: space.updatedAt.toISOString(),
    } satisfies InventorySpaceSummary;
  }

  async updateSpace(
    spaceId: string,
    userId: string,
    body: UpdateInventorySpaceBody,
  ) {
    await this.requireRole(spaceId, userId, [
      InventorySpaceRole.owner,
      InventorySpaceRole.manager,
    ]);
    const updated = await this.prisma.inventorySpace.update({
      where: { id: spaceId },
      data: { name: body.name },
    });
    return { id: updated.id, name: updated.name };
  }

  async deleteSpace(spaceId: string, userId: string) {
    const membership = await this.requireRole(spaceId, userId, [
      InventorySpaceRole.owner,
    ]);
    if (membership.space.type === InventorySpaceType.personal) {
      throw new BadRequestException("내 냉장고는 지울 수 없어요.");
    }
    await this.prisma.inventorySpace.delete({ where: { id: spaceId } });
    return { id: spaceId };
  }

  async listMembers(
    spaceId: string,
    userId: string,
  ): Promise<InventorySpaceMember[]> {
    await this.requireMembership(spaceId, userId);
    const memberships = await this.prisma.inventorySpaceMembership.findMany({
      where: { spaceId },
      include: {
        user: {
          select: { id: true, email: true, displayName: true },
        },
      },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    });
    return memberships.map((membership) => ({
      userId: membership.user.id,
      email: membership.user.email,
      displayName: membership.user.displayName,
      role: membership.role,
      notificationsEnabled: membership.notificationsEnabled,
      joinedAt: membership.joinedAt.toISOString(),
    }));
  }

  async listInvitations(
    spaceId: string,
    userId: string,
  ): Promise<SpaceInvitation[]> {
    await this.requireRole(spaceId, userId, [
      InventorySpaceRole.owner,
      InventorySpaceRole.manager,
    ]);
    const invitations = await this.prisma.spaceInvitation.findMany({
      where: {
        spaceId,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
    return invitations.map(serializeInvitation);
  }

  async inviteMember(
    spaceId: string,
    userId: string,
    body: InviteSpaceMemberBody,
  ) {
    const actor = await this.requireRole(spaceId, userId, [
      InventorySpaceRole.owner,
      InventorySpaceRole.manager,
    ]);
    if (
      body.role === InventorySpaceRole.manager &&
      actor.role !== InventorySpaceRole.owner
    ) {
      throw new ForbiddenException("관리자 초대는 소유자만 할 수 있어요.");
    }

    const email = normalizeEmail(body.email);
    const [existingUser, inviter] = await Promise.all([
      this.prisma.user.findUnique({
        where: { email },
        select: { id: true },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { displayName: true, email: true },
      }),
    ]);
    if (existingUser) {
      const existingMembership =
        await this.prisma.inventorySpaceMembership.findUnique({
          where: {
            spaceId_userId: { spaceId, userId: existingUser.id },
          },
        });
      if (existingMembership) {
        throw new ConflictException("이미 함께 쓰고 있는 구성원이에요.");
      }
    }

    const token = randomBytes(32).toString("base64url");
    const invitation = await this.prisma.$transaction(async (tx) => {
      await tx.spaceInvitation.updateMany({
        where: { spaceId, email, acceptedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return tx.spaceInvitation.create({
        data: {
          spaceId,
          email,
          role: body.role as InventorySpaceRole,
          tokenHash: hashToken(token),
          invitedByUserId: userId,
          expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
        },
      });
    });

    try {
      await this.mailService.sendSpaceInvitation({
        email,
        token,
        spaceName: actor.space.name,
        inviterName: inviter?.displayName?.trim() || inviter?.email || "구성원",
      });
    } catch (error) {
      await this.prisma.spaceInvitation.delete({
        where: { id: invitation.id },
      });
      throw error;
    }

    return serializeInvitation(invitation);
  }

  async revokeInvitation(spaceId: string, invitationId: string, userId: string) {
    await this.requireRole(spaceId, userId, [
      InventorySpaceRole.owner,
      InventorySpaceRole.manager,
    ]);
    const updated = await this.prisma.spaceInvitation.updateMany({
      where: {
        id: invitationId,
        spaceId,
        acceptedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    if (updated.count !== 1) {
      throw new NotFoundException("초대를 다시 찾지 못했어요.");
    }
    return { id: invitationId };
  }

  async acceptInvitation(userId: string, body: AcceptSpaceInvitationBody) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, emailVerifiedAt: true },
    });
    if (!user?.email || !user.emailVerifiedAt) {
      throw new UnauthorizedException("메일 확인을 마친 계정으로 들어와 주세요.");
    }

    const invitation = await this.prisma.spaceInvitation.findUnique({
      where: { tokenHash: hashToken(body.token) },
      include: { space: true },
    });
    if (
      !invitation ||
      invitation.acceptedAt ||
      invitation.revokedAt ||
      invitation.expiresAt.getTime() <= Date.now()
    ) {
      throw new BadRequestException("초대 링크가 만료됐거나 이미 사용됐어요.");
    }
    if (normalizeEmail(user.email) !== normalizeEmail(invitation.email)) {
      throw new ForbiddenException(
        "초대받은 이메일 계정으로 로그인해 주세요.",
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.spaceInvitation.updateMany({
        where: {
          id: invitation.id,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { acceptedAt: new Date() },
      });
      if (claimed.count !== 1) {
        throw new ConflictException("이미 사용된 초대 링크예요.");
      }
      await tx.inventorySpaceMembership.upsert({
        where: {
          spaceId_userId: { spaceId: invitation.spaceId, userId },
        },
        create: {
          spaceId: invitation.spaceId,
          userId,
          role: invitation.role,
          notificationsEnabled: body.notificationsEnabled,
        },
        update: {
          notificationsEnabled: body.notificationsEnabled,
        },
      });
    });

    return {
      spaceId: invitation.spaceId,
      spaceName: invitation.space.name,
    };
  }

  async updateMemberRole(
    spaceId: string,
    targetUserId: string,
    userId: string,
    role: Extract<SharedInventorySpaceRole, "manager" | "member">,
  ) {
    await this.requireRole(spaceId, userId, [InventorySpaceRole.owner]);
    if (targetUserId === userId) {
      throw new BadRequestException("내 역할은 소유권 이전에서 바꿀 수 있어요.");
    }
    const updated = await this.prisma.inventorySpaceMembership.updateMany({
      where: {
        spaceId,
        userId: targetUserId,
        role: { not: InventorySpaceRole.owner },
      },
      data: { role: role as InventorySpaceRole },
    });
    if (updated.count !== 1) {
      throw new NotFoundException("구성원을 다시 찾지 못했어요.");
    }
    return { userId: targetUserId, role };
  }

  async removeMember(spaceId: string, targetUserId: string, userId: string) {
    const actor = await this.requireMembership(spaceId, userId);
    const target = await this.prisma.inventorySpaceMembership.findUnique({
      where: { spaceId_userId: { spaceId, userId: targetUserId } },
    });
    if (!target) {
      throw new NotFoundException("구성원을 다시 찾지 못했어요.");
    }
    if (target.role === InventorySpaceRole.owner) {
      throw new BadRequestException("소유권을 먼저 넘겨 주세요.");
    }
    const isSelf = targetUserId === userId;
    const canRemove =
      isSelf ||
      actor.role === InventorySpaceRole.owner ||
      (actor.role === InventorySpaceRole.manager &&
        target.role === InventorySpaceRole.member);
    if (!canRemove) {
      throw new ForbiddenException("이 구성원을 내보낼 권한이 없어요.");
    }
    await this.prisma.inventorySpaceMembership.delete({
      where: { spaceId_userId: { spaceId, userId: targetUserId } },
    });
    return { userId: targetUserId };
  }

  async transferOwnership(
    spaceId: string,
    targetUserId: string,
    userId: string,
  ) {
    const actor = await this.requireRole(spaceId, userId, [
      InventorySpaceRole.owner,
    ]);
    if (actor.space.type === InventorySpaceType.personal) {
      throw new BadRequestException("내 냉장고의 소유권은 넘길 수 없어요.");
    }
    const target = await this.prisma.inventorySpaceMembership.findUnique({
      where: { spaceId_userId: { spaceId, userId: targetUserId } },
    });
    if (!target || targetUserId === userId) {
      throw new BadRequestException("소유권을 넘길 구성원을 골라 주세요.");
    }
    await this.prisma.$transaction([
      this.prisma.inventorySpace.update({
        where: { id: spaceId },
        data: { ownerUserId: targetUserId },
      }),
      this.prisma.inventorySpaceMembership.update({
        where: { spaceId_userId: { spaceId, userId } },
        data: { role: InventorySpaceRole.manager },
      }),
      this.prisma.inventorySpaceMembership.update({
        where: { spaceId_userId: { spaceId, userId: targetUserId } },
        data: { role: InventorySpaceRole.owner },
      }),
    ]);
    return { ownerUserId: targetUserId };
  }

  async updateNotifications(spaceId: string, userId: string, enabled: boolean) {
    await this.requireMembership(spaceId, userId);
    const membership = await this.prisma.inventorySpaceMembership.update({
      where: { spaceId_userId: { spaceId, userId } },
      data: { notificationsEnabled: enabled },
    });
    return { enabled: membership.notificationsEnabled };
  }

  async requireMembership(spaceId: string, userId: string) {
    const membership = await this.prisma.inventorySpaceMembership.findUnique({
      where: { spaceId_userId: { spaceId, userId } },
      include: { space: true },
    });
    if (!membership) {
      throw new NotFoundException("이 냉장고를 다시 찾지 못했어요.");
    }
    return membership;
  }

  async requireRole(
    spaceId: string,
    userId: string,
    roles: InventorySpaceRole[],
  ) {
    const membership = await this.requireMembership(spaceId, userId);
    if (!roles.includes(membership.role)) {
      throw new ForbiddenException("이 작업을 할 권한이 없어요.");
    }
    return membership;
  }
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function serializeInvitation(invitation: {
  id: string;
  spaceId: string;
  email: string;
  role: InventorySpaceRole;
  expiresAt: Date;
  createdAt: Date;
}): SpaceInvitation {
  return {
    id: invitation.id,
    spaceId: invitation.spaceId,
    email: invitation.email,
    role:
      invitation.role === InventorySpaceRole.manager ? "manager" : "member",
    expiresAt: invitation.expiresAt.toISOString(),
    createdAt: invitation.createdAt.toISOString(),
  };
}
