import { createSign } from "node:crypto";
import {
  BadGatewayException,
  BadRequestException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  Environment as AppleEnvironment,
  SignedDataVerifier,
} from "@apple/app-store-server-library";

const APPLE_PRODUCTION_BASE_URL = "https://api.storekit.apple.com";
const APPLE_SANDBOX_BASE_URL = "https://api.storekit-sandbox.apple.com";

/** Apple App Store Server API error when the transaction belongs to the other environment. */
export const APPLE_TRANSACTION_ID_NOT_FOUND = 4040010;

export class AppleStoreApiError extends Error {
  constructor(
    readonly status: number,
    readonly errorCode?: number,
  ) {
    super(
      errorCode
        ? `Apple Store API ${status} (${errorCode})`
        : `Apple Store API ${status}`,
    );
    this.name = "AppleStoreApiError";
  }
}

export function getPreferredAppleEnvironment(
  requested?: "sandbox" | "production",
): "sandbox" | "production" {
  const configured =
    process.env.APPLE_APP_STORE_ENVIRONMENT === "sandbox"
      ? "sandbox"
      : "production";

  // Production deploys must never honor a client-requested sandbox override.
  if (process.env.NODE_ENV === "production" || configured === "production") {
    return "production";
  }

  return requested ?? configured;
}

export async function fetchAppleStoreJson<T>(
  path: string,
  environment: "sandbox" | "production",
): Promise<T> {
  const baseUrl =
    environment === "sandbox" ? APPLE_SANDBOX_BASE_URL : APPLE_PRODUCTION_BASE_URL;
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${signAppleServerApiJwt()}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      errorCode?: number;
    } | null;
    throw new AppleStoreApiError(response.status, body?.errorCode);
  }

  return (await response.json()) as T;
}

/**
 * Resolve Apple transactions across environments: try preferred first, then
 * sandbox on 4040010 when preferred was production (TestFlight / App Review).
 */
export async function fetchAppleStoreJsonWithFallback<T>(
  path: string,
  preferred: "sandbox" | "production",
): Promise<{ payload: T; environment: "sandbox" | "production" }> {
  try {
    return {
      payload: await fetchAppleStoreJson<T>(path, preferred),
      environment: preferred,
    };
  } catch (error) {
    if (
      preferred === "production" &&
      error instanceof AppleStoreApiError &&
      (error.errorCode === APPLE_TRANSACTION_ID_NOT_FOUND ||
        error.status === 404)
    ) {
      try {
        return {
          payload: await fetchAppleStoreJson<T>(path, "sandbox"),
          environment: "sandbox",
        };
      } catch (sandboxError) {
        if (sandboxError instanceof AppleStoreApiError) {
          throwAppleStoreVerificationError(sandboxError.status);
        }
        throw sandboxError;
      }
    }
    if (error instanceof AppleStoreApiError) {
      throwAppleStoreVerificationError(error.status);
    }
    throw error;
  }
}

export function throwAppleStoreVerificationError(status: number): never {
  if (status === 400 || status === 404) {
    throw new BadRequestException("Apple 구독 정보를 찾지 못했습니다.");
  }
  if (status === 401 || status === 403) {
    throw new ServiceUnavailableException("Apple 검증 권한을 확인해주세요.");
  }
  throw new BadGatewayException("Apple 구독 검증에 실패했습니다.");
}

export function createAppleSignedDataVerifier(environment: AppleEnvironment) {
  const roots = (process.env.APPLE_ROOT_CERTIFICATES_BASE64 ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => Buffer.from(value, "base64"));
  if (roots.length === 0) {
    throw new ServiceUnavailableException(
      "Apple Root 인증서가 설정되지 않았습니다.",
    );
  }
  const bundleId = getRequiredEnv(
    "APPLE_BUNDLE_ID",
    "Apple bundle ID가 설정되지 않았습니다.",
  );
  const appAppleId =
    environment === AppleEnvironment.PRODUCTION
      ? Number(
          getRequiredEnv(
            "APPLE_APP_ID",
            "Apple app ID가 설정되지 않았습니다.",
          ),
        )
      : undefined;
  if (appAppleId !== undefined && !Number.isInteger(appAppleId)) {
    throw new ServiceUnavailableException("Apple app ID가 올바르지 않습니다.");
  }

  return new SignedDataVerifier(
    roots,
    true,
    environment,
    bundleId,
    appAppleId,
  );
}

function signAppleServerApiJwt() {
  const issuerId = getRequiredEnv(
    "APPLE_APP_STORE_ISSUER_ID",
    "Apple App Store issuer ID가 설정되지 않았습니다.",
  );
  const keyId = getRequiredEnv(
    "APPLE_APP_STORE_KEY_ID",
    "Apple App Store key ID가 설정되지 않았습니다.",
  );
  const bundleId = getRequiredEnv(
    "APPLE_BUNDLE_ID",
    "Apple bundle ID가 설정되지 않았습니다.",
  );
  const privateKey = getRequiredEnv(
    "APPLE_APP_STORE_PRIVATE_KEY",
    "Apple App Store private key가 설정되지 않았습니다.",
  ).replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);

  return signJwt(
    { alg: "ES256", kid: keyId, typ: "JWT" },
    {
      iss: issuerId,
      iat: now,
      exp: now + 5 * 60,
      aud: "appstoreconnect-v1",
      bid: bundleId,
    },
    privateKey,
  );
}

function signJwt(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  privateKey: string,
) {
  const input = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const signer = createSign("SHA256");
  signer.update(input);
  signer.end();
  const signature = signer.sign(privateKey);
  return `${input}.${derToJoseSignature(Uint8Array.from(signature), 32).toString("base64url")}`;
}

function derToJoseSignature(
  signature: Uint8Array<ArrayBufferLike>,
  partLength: number,
) {
  let offset = 0;
  if (signature[offset++] !== 0x30) {
    throw new ServiceUnavailableException("Apple JWT 서명 형식이 올바르지 않습니다.");
  }
  offset += readDerLength(signature, offset).bytesRead;
  if (signature[offset++] !== 0x02) {
    throw new ServiceUnavailableException("Apple JWT 서명 형식이 올바르지 않습니다.");
  }
  const rLength = readDerLength(signature, offset);
  offset += rLength.bytesRead;
  const r = signature.subarray(offset, offset + rLength.length);
  offset += rLength.length;
  if (signature[offset++] !== 0x02) {
    throw new ServiceUnavailableException("Apple JWT 서명 형식이 올바르지 않습니다.");
  }
  const sLength = readDerLength(signature, offset);
  offset += sLength.bytesRead;
  const s = signature.subarray(offset, offset + sLength.length);
  const output = new Uint8Array(partLength * 2);
  output.set(normalizeEcdsaPart(r, partLength), 0);
  output.set(normalizeEcdsaPart(s, partLength), partLength);
  return Buffer.from(output);
}

function readDerLength(buffer: Uint8Array<ArrayBufferLike>, offset: number) {
  const first = buffer[offset];
  if (first === undefined) {
    throw new ServiceUnavailableException("JWT 서명 길이를 확인하지 못했습니다.");
  }
  if (first < 0x80) return { length: first, bytesRead: 1 };
  const lengthBytes = first & 0x7f;
  let length = 0;
  for (let index = 0; index < lengthBytes; index += 1) {
    const byte = buffer[offset + 1 + index];
    if (byte === undefined) {
      throw new ServiceUnavailableException("JWT 서명 길이를 확인하지 못했습니다.");
    }
    length = (length << 8) + byte;
  }
  return { length, bytesRead: 1 + lengthBytes };
}

function normalizeEcdsaPart(
  part: Uint8Array<ArrayBufferLike>,
  length: number,
) {
  let normalized = part;
  while (normalized.length > length && normalized[0] === 0) {
    normalized = normalized.subarray(1);
  }
  if (normalized.length > length) {
    throw new ServiceUnavailableException("JWT 서명 길이가 올바르지 않습니다.");
  }
  const output = new Uint8Array(length);
  output.set(normalized, length - normalized.length);
  return output;
}

function getRequiredEnv(name: string, message: string) {
  const value = process.env[name];
  if (!value) throw new ServiceUnavailableException(message);
  return value;
}

function base64UrlJson(value: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}
