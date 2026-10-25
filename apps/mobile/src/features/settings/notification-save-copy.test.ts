import { describe, expect, it } from "vitest";
import { spaceNotificationSaveCopy } from "./notification-save-copy";

describe("per-space notification save feedback", () => {
  it.each([true, false])("marks a change pending without claiming success (enabled %s)", (enabled) => {
    expect(spaceNotificationSaveCopy(enabled, "pending")).toContain("저장 중");
    expect(spaceNotificationSaveCopy(enabled, "pending")).not.toContain("저장됨");
  });
  it("reports rejected writes and preserves the confirmed state", () => {
    expect(spaceNotificationSaveCopy(false, "error")).toContain("쉬고 있어요");
    expect(spaceNotificationSaveCopy(false, "error")).toContain("저장하지 못했어요");
  });
  it("marks only a successful write as saved", () => {
    expect(spaceNotificationSaveCopy(true, "success")).toContain("저장됨");
    expect(spaceNotificationSaveCopy(true)).not.toContain("저장됨");
  });
});
