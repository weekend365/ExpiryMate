import { z } from "zod";

export const authUserRoleSchema = z.enum(["user", "admin"]);
export const authAccountTypeSchema = z.enum(["anonymous", "registered"]);

export const authUserSchema = z.object({
  id: z.string(),
  email: z.string().email().nullable().optional(),
  displayName: z.string().nullable().optional(),
  role: authUserRoleSchema,
  accountType: authAccountTypeSchema,
  emailVerifiedAt: z.string().nullable().optional(),
  requiresEmailVerification: z.boolean().optional(),
});

export const authSessionSchema = z.object({
  user: authUserSchema,
  accessToken: z.string(),
  refreshToken: z.string().optional(),
});

export const registerPendingResponseSchema = z.object({
  requiresEmailVerification: z.literal(true),
  email: z.string().email(),
});

export const registerResponseSchema = z.union([
  registerPendingResponseSchema,
  authSessionSchema,
]);

export const registerRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).optional(),
});

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/** 403 when a registered account signs in before verifying email. */
export const EMAIL_NOT_VERIFIED_ERROR_CODE = "EMAIL_NOT_VERIFIED" as const;

export const startOAuthResponseSchema = z.object({
  state: z.string().min(1),
  codeChallenge: z.string().min(1),
  codeChallengeMethod: z.literal("S256"),
  redirectUri: z.string().min(1),
  expiresAt: z.string().min(1),
});
