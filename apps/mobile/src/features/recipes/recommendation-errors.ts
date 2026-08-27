export function getRecommendationErrorMessage(error: unknown) {
  if (!error) {
    return null;
  }

  return error instanceof Error
    ? error.message
    : "앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?";
}
