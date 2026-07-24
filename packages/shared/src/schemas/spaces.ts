import { z } from "zod";
import { fieldLimits } from "../constants/field-limits";

export const inventorySpaceTypeSchema = z.enum([
  "personal",
  "household",
  "store",
]);

export const inventorySpaceRoleSchema = z.enum([
  "owner",
  "manager",
  "member",
]);

export const inventorySpaceSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: inventorySpaceTypeSchema,
  myRole: inventorySpaceRoleSchema,
  notificationsEnabled: z.boolean(),
  memberCount: z.number().int().positive(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const inventorySpaceMemberSchema = z.object({
  userId: z.string(),
  email: z.string().nullable(),
  displayName: z.string().nullable(),
  role: inventorySpaceRoleSchema,
  notificationsEnabled: z.boolean(),
  joinedAt: z.string(),
});

export const spaceInvitationSchema = z.object({
  id: z.string(),
  spaceId: z.string(),
  email: z.string().email(),
  role: z.enum(["manager", "member"]),
  expiresAt: z.string(),
  createdAt: z.string(),
});

export const createInventorySpaceBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "함께 쓸 냉장고 이름을 알려 주세요")
    .max(
      fieldLimits.inventorySpaceName,
      `이름은 ${fieldLimits.inventorySpaceName}자까지예요`,
    ),
  type: z.enum(["household", "store"]),
});

export const updateInventorySpaceBodySchema = z.object({
  name: createInventorySpaceBodySchema.shape.name,
});

export const inviteSpaceMemberBodySchema = z.object({
  email: z.string().trim().toLowerCase().email("이메일 주소를 확인해 주세요"),
  role: z.enum(["manager", "member"]).default("member"),
});

export const updateSpaceMemberBodySchema = z.object({
  role: z.enum(["manager", "member"]),
});

export const transferSpaceOwnershipBodySchema = z.object({
  userId: z.string().trim().min(1),
});

export const acceptSpaceInvitationBodySchema = z.object({
  token: z.string().trim().min(32),
  notificationsEnabled: z.boolean().default(false),
});

export const updateSpaceNotificationBodySchema = z.object({
  enabled: z.boolean(),
});

export type InventorySpaceType = z.infer<typeof inventorySpaceTypeSchema>;
export type InventorySpaceRole = z.infer<typeof inventorySpaceRoleSchema>;
export type InventorySpaceSummary = z.infer<
  typeof inventorySpaceSummarySchema
>;
export type InventorySpaceMember = z.infer<typeof inventorySpaceMemberSchema>;
export type SpaceInvitation = z.infer<typeof spaceInvitationSchema>;
export type CreateInventorySpaceBody = z.output<
  typeof createInventorySpaceBodySchema
>;
export type UpdateInventorySpaceBody = z.output<
  typeof updateInventorySpaceBodySchema
>;
export type InviteSpaceMemberBody = z.output<
  typeof inviteSpaceMemberBodySchema
>;
export type UpdateSpaceMemberBody = z.output<
  typeof updateSpaceMemberBodySchema
>;
export type TransferSpaceOwnershipBody = z.output<
  typeof transferSpaceOwnershipBodySchema
>;
export type AcceptSpaceInvitationBody = z.output<
  typeof acceptSpaceInvitationBodySchema
>;
export type UpdateSpaceNotificationBody = z.output<
  typeof updateSpaceNotificationBodySchema
>;
