import { ProductCategory } from "@expirymate/shared";
import { describe, expect, it } from "vitest";
import {
  extraDetailsRowLabel,
  formatPutAwayMessage,
  formatPutAwaySupportingMessage,
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

  it("adds an expiry-aware follow-up under the put-away line", () => {
    const now = new Date("2026-08-18T03:00:00.000Z");

    expect(formatPutAwaySupportingMessage()).toBe(
      "다음 재료도 이어서 넣을까요?",
    );
    expect(
      formatPutAwaySupportingMessage({
        expiryDate: "2026-08-17",
        now,
      }),
    ).toBe("기한이 이미 지났어요. 바로 손보면 좋아요.");
    expect(
      formatPutAwaySupportingMessage({
        expiryDate: "2026-08-18",
        now,
      }),
    ).toBe("오늘까지예요. 저녁에 쓰면 딱이에요.");
    expect(
      formatPutAwaySupportingMessage({
        expiryDate: "2026-08-19",
        now,
      }),
    ).toBe("내일이 기한이에요. 곧 손보면 든든해요.");
    expect(
      formatPutAwaySupportingMessage({
        expiryDate: "2026-08-20",
        now,
      }),
    ).toBe("2일 남았어요. 여유 있을 때 써 볼까요?");
    expect(
      formatPutAwaySupportingMessage({
        expiryDate: "2026-08-24",
        now,
      }),
    ).toBe("일주일 안에 챙기면 든든해요.");
    expect(
      formatPutAwaySupportingMessage({
        expiryDate: "2026-09-18",
        now,
      }),
    ).toBe("냉장고에 잘 넣어뒀어요. 다음 재료도 이어서 넣을까요?");
    expect(
      formatPutAwaySupportingMessage({
        expiryDate: "2026-09-18",
        sessionCount: 2,
        now,
      }),
    ).toBe("하나 더 챙겼어요. 냉장고가 든든해졌어요.");
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
