const AUTH_ERROR_FALLBACK =
  "앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?";

export function getAuthErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : AUTH_ERROR_FALLBACK;
}
