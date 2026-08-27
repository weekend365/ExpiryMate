import { EMAIL_NOT_VERIFIED_ERROR_CODE } from "@expirymate/shared";

const AUTH_ERROR_FALLBACK =
  "앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?";

export function getAuthErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : AUTH_ERROR_FALLBACK;
}

export function isEmailNotVerifiedAuthError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === EMAIL_NOT_VERIFIED_ERROR_CODE
  );
}
