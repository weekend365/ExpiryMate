import { describe, expect, it } from "vitest";
import { spaceNotificationStatusCopy } from "./space-notification-copy";

describe("spaceNotificationStatusCopy", () => {
  it("tells the user whether this fridge is muted", () => {
    expect(spaceNotificationStatusCopy(true)).toBe(
      "유통기한 알림을 받고 있어요",
    );
    expect(spaceNotificationStatusCopy(false)).toBe(
      "유통기한 알림은 쉬고 있어요",
    );
  });
});
