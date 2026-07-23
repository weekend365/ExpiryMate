import { describe, expect, it } from "vitest";
import { SupportInquiryCategory } from "../enums/app-enums";
import { supportInquiryCreateSchema } from "./support";

describe("supportInquiryCreateSchema", () => {
  it("accepts a valid inquiry", () => {
    const parsed = supportInquiryCreateSchema.parse({
      category: SupportInquiryCategory.BUG,
      body: "알림이 오지 않아요. 설정은 켜 두었어요.",
      platform: "ios",
      appVersion: "1.0.0",
    });

    expect(parsed.category).toBe(SupportInquiryCategory.BUG);
    expect(parsed.body.length).toBeGreaterThanOrEqual(10);
  });

  it("rejects bodies that are too short", () => {
    const result = supportInquiryCreateSchema.safeParse({
      category: SupportInquiryCategory.OTHER,
      body: "짧아요",
    });

    expect(result.success).toBe(false);
  });
});
