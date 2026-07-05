import { SetMetadata } from "@nestjs/common";

export const AUTH_RATE_LIMIT_METADATA = "expirymate:auth-rate-limit";

export interface AuthRateLimitPolicy {
  name: string;
  max: number;
  windowSeconds: number;
  bodyFields?: string[];
}

export const AuthRateLimit = (policy: AuthRateLimitPolicy) =>
  SetMetadata(AUTH_RATE_LIMIT_METADATA, policy);
