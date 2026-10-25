import { spaceNotificationStatusCopy } from "../spaces/space-notification-copy";

export function spaceNotificationSaveCopy(
  enabled: boolean,
  status?: "idle" | "pending" | "success" | "error",
) {
  const current = spaceNotificationStatusCopy(enabled);
  if (status === "pending") return `${current} · 변경 저장 중…`;
  if (status === "error") return `${current} · 저장하지 못했어요. 다시 변경해 주세요.`;
  if (status === "success") return `${current} · 저장됨`;
  return current;
}
