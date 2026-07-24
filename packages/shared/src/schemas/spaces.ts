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

export const SPACE_INVITATION_CODE_LENGTH = 8;
export const SPACE_INVITATION_CODE_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizeSpaceInvitationCode(value: string) {
  return value.toUpperCase().replace(/[\s-]/g, "");
}

export function formatSpaceInvitationCode(value: string) {
  const normalized = normalizeSpaceInvitationCode(value).slice(
    0,
    SPACE_INVITATION_CODE_LENGTH,
  );
  return normalized.length > 4
    ? `${normalized.slice(0, 4)}-${normalized.slice(4)}`
    : normalized;
}

export function isValidSpaceInvitationCode(value: string) {
  const normalized = normalizeSpaceInvitationCode(value);
  return (
    normalized.length === SPACE_INVITATION_CODE_LENGTH &&
    [...normalized].every((character) =>
      SPACE_INVITATION_CODE_ALPHABET.includes(character),
    )
  );
}

const spaceInvitationCodeValueSchema = z
  .string()
  .transform(normalizeSpaceInvitationCode)
  .refine(isValidSpaceInvitationCode, "초대 코드 8자리를 확인해 주세요");

export const spaceInvitationCodeSchema = z.object({
  id: z.string(),
  spaceId: z.string(),
  role: z.literal("member"),
  expiresAt: z.string(),
  createdAt: z.string(),
});

export const createSpaceInvitationCodeResponseSchema = z.object({
  invitation: spaceInvitationCodeSchema,
  code: z.string().refine(isValidSpaceInvitationCode),
});

export const previewSpaceInvitationCodeBodySchema = z.object({
  code: spaceInvitationCodeValueSchema,
});

export const spaceInvitationCodePreviewSchema = z.object({
  spaceId: z.string(),
  spaceName: z.string(),
  spaceType: z.enum(["household", "store"]),
  expiresAt: z.string(),
});

export const acceptSpaceInvitationCodeBodySchema = z.object({
  code: spaceInvitationCodeValueSchema,
  notificationsEnabled: z.boolean().default(false),
});

export const acceptSpaceInvitationResultSchema = z.object({
  spaceId: z.string(),
  spaceName: z.string(),
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
export type SpaceInvitationCode = z.infer<
  typeof spaceInvitationCodeSchema
>;
export type CreateSpaceInvitationCodeResponse = z.infer<
  typeof createSpaceInvitationCodeResponseSchema
>;
export type PreviewSpaceInvitationCodeBody = z.output<
  typeof previewSpaceInvitationCodeBodySchema
>;
export type SpaceInvitationCodePreview = z.infer<
  typeof spaceInvitationCodePreviewSchema
>;
export type AcceptSpaceInvitationCodeBody = z.output<
  typeof acceptSpaceInvitationCodeBodySchema
>;
export type AcceptSpaceInvitationResult = z.infer<
  typeof acceptSpaceInvitationResultSchema
>;
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
