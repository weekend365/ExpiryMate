import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { AuthSession, AuthenticatedUser } from "./auth.types";

interface TokenPayload {
  ownerKey: string;
  kind: "anonymous";
  issuedAt: string;
}

const TOKEN_VERSION = "v1";
const DEV_SECRET = "expirymate-local-auth-secret";
const DEFAULT_OWNER_KEY = "demo-user";

@Injectable()
export class AuthService {
  issueAnonymousSession(): AuthSession {
    const ownerKey = `anon_${randomUUID()}`;
    const accessToken = this.signToken({
      ownerKey,
      kind: "anonymous",
      issuedAt: new Date().toISOString(),
    });

    return {
      ownerKey,
      tokenType: "Bearer",
      accessToken,
    };
  }

  verifyBearerToken(token: string): AuthenticatedUser {
    const [version, payloadPart, signature] = token.split(".");

    if (version !== TOKEN_VERSION || !payloadPart || !signature) {
      throw new UnauthorizedException("인증 토큰이 올바르지 않습니다.");
    }

    const expectedSignature = this.sign(`${version}.${payloadPart}`);

    if (!safeEqual(signature, expectedSignature)) {
      throw new UnauthorizedException("인증 토큰이 올바르지 않습니다.");
    }

    const payload = parsePayload(payloadPart);

    if (!payload.ownerKey || payload.kind !== "anonymous") {
      throw new UnauthorizedException("인증 토큰이 올바르지 않습니다.");
    }

    return {
      ownerKey: payload.ownerKey,
      tokenKind: payload.kind,
    };
  }

  getDevFallbackUser(): AuthenticatedUser | null {
    if (process.env.AUTH_ALLOW_DEV_FALLBACK === "false") {
      return null;
    }

    if (process.env.NODE_ENV === "production") {
      return null;
    }

    return {
      ownerKey: process.env.DEFAULT_OWNER_KEY ?? DEFAULT_OWNER_KEY,
      tokenKind: "dev",
    };
  }

  private signToken(payload: TokenPayload) {
    const encodedPayload = encodeBase64Url(JSON.stringify(payload));
    const signingInput = `${TOKEN_VERSION}.${encodedPayload}`;
    const signature = this.sign(signingInput);

    return `${signingInput}.${signature}`;
  }

  private sign(input: string) {
    return createHmac("sha256", this.getSecret()).update(input).digest("base64url");
  }

  private getSecret() {
    const secret = process.env.AUTH_TOKEN_SECRET;

    if (secret) {
      return secret;
    }

    if (process.env.NODE_ENV === "production") {
      throw new ServiceUnavailableException(
        "AUTH_TOKEN_SECRET 환경변수가 설정되지 않았습니다.",
      );
    }

    return DEV_SECRET;
  }
}

function parsePayload(payloadPart: string): TokenPayload {
  try {
    return JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
  } catch {
    throw new UnauthorizedException("인증 토큰이 올바르지 않습니다.");
  }
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(new Uint8Array(leftBuffer), new Uint8Array(rightBuffer));
}
