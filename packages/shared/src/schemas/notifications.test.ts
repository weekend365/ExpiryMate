import { describe, expect, it } from "vitest";
import { updateNotificationPreferenceSchema } from "./notifications";

describe("notification preferences contract", () => {
  it("accepts day boundaries, grouping and partial updates", () => {
    expect(
      updateNotificationPreferenceSchema.parse({
        deliveryTime: "00:00",
        quietHoursEnd: "23:59",
        groupBySpace: true,
        reminderDaysBefore: [7, 1, 1, 3],
      }),
    ).toEqual({
      deliveryTime: "00:00",
      quietHoursEnd: "23:59",
      groupBySpace: true,
      reminderDaysBefore: [1, 3, 7],
    });
    expect(
      updateNotificationPreferenceSchema.parse({ enabled: false }),
    ).toEqual({ enabled: false });
  });
  it.each(["24:00", "09:60", "9:00", "-1:00"])(
    "rejects invalid time %s",
    (deliveryTime) => {
      expect(
        updateNotificationPreferenceSchema.safeParse({ deliveryTime }).success,
      ).toBe(false);
    },
  );
  it.each([[0], [-1], [1.5], [366], Array(31).fill(1)])(
    "rejects invalid reminder days %j",
    (...values) => {
      const reminderDaysBefore =
        values.length === 1 && Array.isArray(values[0]) ? values[0] : values;
      expect(
        updateNotificationPreferenceSchema.safeParse({ reminderDaysBefore })
          .success,
      ).toBe(false);
    },
  );
});
