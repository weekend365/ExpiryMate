import { ProductCategory } from "@expirymate/shared";
import { describe, expect, it } from "vitest";
import {
  extraDetailsRowLabel,
  formatPutAwayMessage,
  formatUpdatedMessage,
  koreanObjectParticle,
} from "./inventory-form-copy";

describe("inventory form copy helpers", () => {
  it("picks 을/를 from the last Hangul syllable", () => {
    expect(koreanObjectParticle("우유")).toBe("를");
    expect(koreanObjectParticle("계란")).toBe("을");
    expect(koreanObjectParticle("milk")).toBe("를");
  });

  it("formats put-away and update messages with the object particle", () => {
    expect(formatPutAwayMessage("우유")).toBe("우유를 넣었어요");
    expect(formatUpdatedMessage("계란")).toBe("계란을 바꿔 뒀어요");
  });

  it("labels extra details as review when any optional field is set", () => {
    expect(extraDetailsRowLabel({})).toBe("브랜드·메모 더 적을게요");
    expect(extraDetailsRowLabel({ brand: "서울우유" })).toBe(
      "브랜드·메모 확인하기",
    );
    expect(
      extraDetailsRowLabel({ category: ProductCategory.DAIRY }),
    ).toBe("브랜드·메모 확인하기");
    expect(extraDetailsRowLabel({ notes: "열어 둔 팩" })).toBe(
      "브랜드·메모 확인하기",
    );
  });
});
