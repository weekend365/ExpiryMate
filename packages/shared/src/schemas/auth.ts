import { z } from "zod";

export const authUserRoleSchema = z.enum(["user", "admin"]);
export const authAccountTypeSchema = z.enum(["anonymous", "registered"]);
export const oauthProviderSchema = z.enum([
  "apple",
  "google",
  "kakao",
  "naver",
]);

export const authUserSchema = z.object({
  id: z.string(),
  email: z.string().email().nullable().optional(),
  displayName: z.string().nullable().optional(),
  role: authUserRoleSchema,
  accountType: authAccountTypeSchema,
  emailVerifiedAt: z.string().nullable().optional(),
});

export const authSessionSchema = z.object({
  user: authUserSchema,
  accessToken: z.string(),
  refreshToken: z.string().optional(),
});

export const registerRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).optional(),
});

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshRequestSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export const logoutRequestSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export const requestEmailVerificationSchema = z.object({
  email: z.string().email().optional(),
});

export const verifyEmailRequestSchema = z.object({
  token: z.string().min(1),
});

export const forgotPasswordRequestSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordRequestSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

export const oauthLoginRequestSchema = z.object({
  providerToken: z.string().min(1),
  email: z.string().email().optional(),
  displayName: z.string().optional(),
  /** Naver authorization-code exchange must reuse the same redirect URI. */
  redirectUri: z.string().min(1).optional(),
});
