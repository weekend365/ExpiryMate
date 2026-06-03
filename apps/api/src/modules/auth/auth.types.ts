export interface AuthSession {
  ownerKey: string;
  tokenType: "Bearer";
  accessToken: string;
}

export interface AuthenticatedUser {
  ownerKey: string;
  tokenKind: "anonymous" | "dev";
}

export interface AuthenticatedRequest {
  user?: AuthenticatedUser;
  headers: Record<string, string | string[] | undefined>;
}
