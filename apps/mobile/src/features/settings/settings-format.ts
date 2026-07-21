export function getSettingsErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?";
}

export function formatSubscriptionStore(store?: string | null) {
  if (store === "apple_app_store") {
    return "App Store";
  }

  if (store === "google_play") {
    return "Google Play";
  }

  return "스토어";
}

export function formatSubscriptionExpiry(value?: string | null) {
  if (!value) {
    return "만료일을 아직 못 불러왔어요";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}
