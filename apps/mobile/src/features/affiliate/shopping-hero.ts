import type { JangoHeroNoticeItem } from "../../components/JangoHeroNoticeCarousel";
import type { MascotMood } from "../../components/Mascot";

export function getShoppingHeroNotice(): { message: string; mood: MascotMood } {
  return {
    mood: "speak",
    message: "필요한 식재료, 쿠팡에서 바로 찾아드릴게요. 이름만 알려 주세요.",
  };
}

export function getShoppingHeroNotices(): JangoHeroNoticeItem[] {
  const status = getShoppingHeroNotice();
  return [
    {
      id: "status",
      mood: status.mood,
      message: status.message,
    },
  ];
}

/** Once submitted, search owns the catalog until the user explicitly clears it. */
export function isShoppingSearchActive(
  status: "idle" | "pending" | "error" | "success",
) {
  return status !== "idle";
}

export function initialShoppingQuery(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() ?? "";
}
