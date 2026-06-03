import type {
  AccountType,
  OAuthProvider,
  UserRole,
} from "@prisma/client";

export interface AuthenticatedUser {
  userId: string;
  ownerKey: string;
  role: UserRole;
  accountType: AccountType;
  tokenKind: "access" | "dev";
}

export interface AuthenticatedRequest {
  user?: AuthenticatedUser;
  headers: Record<string, string | string[] | undefined>;
}

export interface OAuthProfile {
  provider: OAuthProvider;
  providerUserId: string;
  email?: string;
  displayName?: string;
  emailVerified?: boolean;
}
