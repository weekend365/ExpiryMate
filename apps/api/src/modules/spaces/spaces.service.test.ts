import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import {
  InventorySpaceRole,
  InventorySpaceType,
  SpaceInvitationMethod,
} from "@prisma/client";
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SpacesService } from "./spaces.service";

const sharedSpace = {
  id: "space-house",
  name: "우리 집",
  type: InventorySpaceType.household,
};

describe("SpacesService", () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let mailService: { sendSpaceInvitation: ReturnType<typeof vi.fn> };
  let service: SpacesService;

  beforeEach(() => {
    prisma = createPrismaMock();
    mailService = {
      sendSpaceInvitation: vi.fn().mockResolvedValue(undefined),
    };
    service = new SpacesService(prisma as never, mailService as never);
  });

  it("denies manager-only work to a regular member", async () => {
    prisma.inventorySpaceMembership.findUnique.mockResolvedValue({
      userId: "user-member",
      role: InventorySpaceRole.member,
      space: sharedSpace,
    });

    await expect(
      service.requireRole("space-house", "user-member", [
        InventorySpaceRole.owner,
        InventorySpaceRole.manager,
      ]),
    ).rejects.toThrow(ForbiddenException);
  });

  it("allows only an owner to invite a manager", async () => {
    prisma.inventorySpaceMembership.findUnique.mockResolvedValue({
      userId: "user-manager",
      role: InventorySpaceRole.manager,
      space: sharedSpace,
    });

    await expect(
      service.inviteMember("space-house", "user-manager", {
        email: "staff@example.com",
        role: "manager",
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.spaceInvitation.create).not.toHaveBeenCalled();
  });

  it("stores only the invitation token hash and mails the original token", async () => {
    prisma.inventorySpaceMembership.findUnique.mockResolvedValue({
      userId: "user-owner",
      role: InventorySpaceRole.owner,
      space: sharedSpace,
    });
    prisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        displayName: "우현",
        email: "owner@example.com",
      });
    prisma.spaceInvitation.create.mockImplementation(async ({ data }) => ({
      id: "invite-1",
      ...data,
      createdAt: new Date("2026-07-24T00:00:00.000Z"),
    }));

    await service.inviteMember("space-house", "user-owner", {
      email: " FAMILY@EXAMPLE.COM ",
      role: "member",
    });

    const mailed = mailService.sendSpaceInvitation.mock.calls[0]?.[0];
    const created = prisma.spaceInvitation.create.mock.calls[0]?.[0].data;
    expect(mailed.token).toHaveLength(43);
    expect(created.email).toBe("family@example.com");
    expect(created.method).toBe(SpaceInvitationMethod.email);
    expect(created.tokenHash).not.toBe(mailed.token);
    expect(created.tokenHash).toBe(
      createHash("sha256").update(mailed.token).digest("hex"),
    );
    expect(created.expiresAt.getTime() - Date.now()).toBeGreaterThan(
      6 * 24 * 60 * 60 * 1000,
    );
  });

  it("creates a hash-only one-time member code for a shared space", async () => {
    prisma.inventorySpaceMembership.findUnique.mockResolvedValue({
      userId: "user-owner",
      role: InventorySpaceRole.owner,
      space: sharedSpace,
    });
    prisma.spaceInvitation.create.mockImplementation(async ({ data }) => ({
      id: "invite-code-1",
      ...data,
      createdAt: new Date("2026-07-24T00:00:00.000Z"),
    }));

    const result = await service.createInvitationCode(
      "space-house",
      "user-owner",
    );

    const created = prisma.spaceInvitation.create.mock.calls[0]?.[0].data;
    expect(result.code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    expect(result.invitation.role).toBe("member");
    expect(created).toEqual(
      expect.objectContaining({
        method: SpaceInvitationMethod.code,
        email: null,
        role: InventorySpaceRole.member,
      }),
    );
    expect(created.tokenHash).not.toContain(result.code.replace("-", ""));
    expect(created.tokenHash).toBe(
      createHash("sha256")
        .update(result.code.replace("-", ""))
        .digest("hex"),
    );
  });

  it("never creates an invitation code for a personal space", async () => {
    prisma.inventorySpaceMembership.findUnique.mockResolvedValue({
      userId: "user-owner",
      role: InventorySpaceRole.owner,
      space: {
        ...sharedSpace,
        id: "personal_user-owner",
        type: InventorySpaceType.personal,
      },
    });

    await expect(
      service.createInvitationCode("personal_user-owner", "user-owner"),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.spaceInvitation.create).not.toHaveBeenCalled();
  });

  it("lists code metadata without returning the stored hash", async () => {
    prisma.inventorySpaceMembership.findUnique.mockResolvedValue({
      userId: "user-manager",
      role: InventorySpaceRole.manager,
      space: sharedSpace,
    });
    prisma.spaceInvitation.findMany.mockResolvedValue([
      {
        ...validCodeInvitation(),
        tokenHash: "secret-hash",
      },
    ]);

    const result = await service.listInvitationCodes(
      "space-house",
      "user-manager",
    );

    expect(prisma.spaceInvitation.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        spaceId: "space-house",
        method: SpaceInvitationMethod.code,
        acceptedAt: null,
        revokedAt: null,
      }),
      orderBy: { createdAt: "desc" },
    });
    expect(result).toEqual([
      {
        id: "invite-code-1",
        spaceId: "space-house",
        role: "member",
        expiresAt: expect.any(String),
        createdAt: expect.any(String),
      },
    ]);
    expect(result[0]).not.toHaveProperty("tokenHash");
    expect(result[0]).not.toHaveProperty("code");
  });

  it("revokes only a pending code in the selected space", async () => {
    prisma.inventorySpaceMembership.findUnique.mockResolvedValue({
      userId: "user-manager",
      role: InventorySpaceRole.manager,
      space: sharedSpace,
    });
    prisma.spaceInvitation.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.revokeInvitationCode(
        "space-house",
        "invite-code-1",
        "user-manager",
      ),
    ).resolves.toEqual({ id: "invite-code-1" });
    expect(prisma.spaceInvitation.updateMany).toHaveBeenCalledWith({
      where: {
        id: "invite-code-1",
        spaceId: "space-house",
        method: SpaceInvitationMethod.code,
        acceptedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("rejects expired or already-used invitation links", async () => {
    prisma.user.findUnique.mockResolvedValue({
      email: "family@example.com",
      emailVerifiedAt: new Date(),
    });
    prisma.spaceInvitation.findUnique.mockResolvedValue({
      id: "invite-expired",
      email: "family@example.com",
      acceptedAt: null,
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1),
      space: sharedSpace,
    });

    await expect(
      service.acceptInvitation("user-family", {
        token: "a".repeat(43),
        notificationsEnabled: false,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.inventorySpaceMembership.upsert).not.toHaveBeenCalled();
  });

  it("revokes only a still-pending invitation in the selected space", async () => {
    prisma.inventorySpaceMembership.findUnique.mockResolvedValue({
      userId: "user-manager",
      role: InventorySpaceRole.manager,
      space: sharedSpace,
    });
    prisma.spaceInvitation.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.revokeInvitation(
        "space-house",
        "invite-1",
        "user-manager",
      ),
    ).resolves.toEqual({ id: "invite-1" });
    expect(prisma.spaceInvitation.updateMany).toHaveBeenCalledWith({
      where: {
        id: "invite-1",
        spaceId: "space-house",
        method: SpaceInvitationMethod.email,
        acceptedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("requires the signed-in email to match the invitation", async () => {
    prisma.user.findUnique.mockResolvedValue({
      email: "other@example.com",
      emailVerifiedAt: new Date(),
    });
    prisma.spaceInvitation.findUnique.mockResolvedValue(
      validInvitation({
        email: "family@example.com",
      }),
    );

    await expect(
      service.acceptInvitation("user-other", {
        token: "a".repeat(43),
        notificationsEnabled: false,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("claims an invitation once before creating membership", async () => {
    prisma.user.findUnique.mockResolvedValue({
      email: "family@example.com",
      emailVerifiedAt: new Date(),
    });
    prisma.spaceInvitation.findUnique.mockResolvedValue(validInvitation());
    prisma.spaceInvitation.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.acceptInvitation("user-family", {
        token: "a".repeat(43),
        notificationsEnabled: false,
      }),
    ).rejects.toThrow(ConflictException);
    expect(prisma.inventorySpaceMembership.upsert).not.toHaveBeenCalled();
  });

  it("joins with notifications disabled by default choice", async () => {
    prisma.user.findUnique.mockResolvedValue({
      email: "family@example.com",
      emailVerifiedAt: new Date(),
    });
    prisma.spaceInvitation.findUnique.mockResolvedValue(validInvitation());
    prisma.spaceInvitation.updateMany.mockResolvedValue({ count: 1 });
    prisma.inventorySpaceMembership.upsert.mockResolvedValue({});

    const result = await service.acceptInvitation("user-family", {
      token: "a".repeat(43),
      notificationsEnabled: false,
    });

    expect(result).toEqual({
      spaceId: "space-house",
      spaceName: "우리 집",
    });
    expect(prisma.inventorySpaceMembership.upsert).toHaveBeenCalledWith({
      where: {
        spaceId_userId: {
          spaceId: "space-house",
          userId: "user-family",
        },
      },
      create: expect.objectContaining({
        role: InventorySpaceRole.member,
        notificationsEnabled: false,
      }),
      update: {
        notificationsEnabled: false,
      },
    });
  });

  it("previews a usable code without exposing its secret", async () => {
    prisma.spaceInvitation.findUnique.mockResolvedValue(validCodeInvitation());
    prisma.inventorySpaceMembership.findUnique.mockResolvedValue(null);

    await expect(
      service.previewInvitationCode("user-family", {
        code: "ABCDEFGH",
      }),
    ).resolves.toEqual({
      spaceId: "space-house",
      spaceName: "우리 집",
      spaceType: InventorySpaceType.household,
      expiresAt: expect.any(String),
    });
  });

  it("does not consume a code when the user is already a member", async () => {
    prisma.spaceInvitation.findUnique.mockResolvedValue(validCodeInvitation());
    prisma.inventorySpaceMembership.findUnique.mockResolvedValue({
      userId: "user-family",
    });

    await expect(
      service.acceptInvitationCode("user-family", {
        code: "ABCDEFGH",
        notificationsEnabled: false,
      }),
    ).rejects.toThrow(ConflictException);
    expect(prisma.spaceInvitation.updateMany).not.toHaveBeenCalled();
  });

  it("claims a code once and creates a member with the chosen notification setting", async () => {
    prisma.spaceInvitation.findUnique.mockResolvedValue(validCodeInvitation());
    prisma.inventorySpaceMembership.findUnique.mockResolvedValue(null);
    prisma.spaceInvitation.updateMany.mockResolvedValue({ count: 1 });
    prisma.inventorySpaceMembership.create.mockResolvedValue({});

    const result = await service.acceptInvitationCode("user-family", {
      code: "ABCD-EFGH",
      notificationsEnabled: true,
    });

    expect(result).toEqual({
      spaceId: "space-house",
      spaceName: "우리 집",
    });
    expect(prisma.spaceInvitation.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: "invite-code-1",
        method: SpaceInvitationMethod.code,
        acceptedAt: null,
        revokedAt: null,
      }),
      data: { acceptedAt: expect.any(Date) },
    });
    expect(prisma.inventorySpaceMembership.create).toHaveBeenCalledWith({
      data: {
        spaceId: "space-house",
        userId: "user-family",
        role: InventorySpaceRole.member,
        notificationsEnabled: true,
      },
    });
  });

  it("rejects an already claimed code before creating membership", async () => {
    prisma.spaceInvitation.findUnique.mockResolvedValue(validCodeInvitation());
    prisma.inventorySpaceMembership.findUnique.mockResolvedValue(null);
    prisma.spaceInvitation.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.acceptInvitationCode("user-family", {
        code: "ABCDEFGH",
        notificationsEnabled: false,
      }),
    ).rejects.toThrow(ConflictException);
    expect(prisma.inventorySpaceMembership.create).not.toHaveBeenCalled();
  });

  it("never deletes the personal inventory space", async () => {
    prisma.inventorySpaceMembership.findUnique.mockResolvedValue({
      userId: "user-owner",
      role: InventorySpaceRole.owner,
      space: {
        ...sharedSpace,
        id: "personal_user-owner",
        type: InventorySpaceType.personal,
      },
    });

    await expect(
      service.deleteSpace("personal_user-owner", "user-owner"),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.inventorySpace.delete).not.toHaveBeenCalled();
  });
});

function validInvitation(overrides: Record<string, unknown> = {}) {
  return {
    id: "invite-1",
    spaceId: "space-house",
    email: "family@example.com",
    role: InventorySpaceRole.member,
    method: SpaceInvitationMethod.email,
    acceptedAt: null,
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    space: sharedSpace,
    ...overrides,
  };
}

function validCodeInvitation(overrides: Record<string, unknown> = {}) {
  return {
    id: "invite-code-1",
    spaceId: "space-house",
    method: SpaceInvitationMethod.code,
    email: null,
    role: InventorySpaceRole.member,
    acceptedAt: null,
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    createdAt: new Date(),
    space: sharedSpace,
    ...overrides,
  };
}

function createPrismaMock() {
  const prisma = {
    inventorySpace: {
      delete: vi.fn(),
    },
    inventorySpaceMembership: {
      create: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    spaceInvitation: {
      create: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    user: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(
      async (
        input:
          | Array<Promise<unknown>>
          | ((transaction: typeof prisma) => Promise<unknown>),
      ) => (typeof input === "function" ? input(prisma) : Promise.all(input)),
    ),
  };
  return prisma;
}
