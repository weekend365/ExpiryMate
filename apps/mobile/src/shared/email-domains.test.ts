import { describe, expect, it } from "vitest";
import {
  EMAIL_DOMAIN_MANUAL,
  EMAIL_DOMAINS,
  joinEmail,
  resolveDomainMode,
  splitEmail,
} from "./email-domains";

describe("splitEmail", () => {
  it("splits local and domain at the last @", () => {
    expect(splitEmail("user@naver.com")).toEqual({
      local: "user",
      domain: "naver.com",
    });
  });

  it("keeps the whole value as local when @ is missing", () => {
    expect(splitEmail("user")).toEqual({ local: "user", domain: "" });
  });
});

describe("joinEmail", () => {
  it("joins local and domain", () => {
    expect(joinEmail("user", "naver.com")).toBe("user@naver.com");
  });

  it("returns local only when domain is empty", () => {
    expect(joinEmail("user", "")).toBe("user");
  });

  it("returns empty when both parts are empty", () => {
    expect(joinEmail("", "")).toBe("");
  });
});

describe("resolveDomainMode", () => {
  it("maps known domains to preset mode", () => {
    expect(resolveDomainMode("naver.com")).toBe("naver.com");
    expect(resolveDomainMode("Gmail.com")).toBe("gmail.com");
  });

  it("maps unknown domains to manual", () => {
    expect(resolveDomainMode("company.co.kr")).toBe(EMAIL_DOMAIN_MANUAL);
    expect(resolveDomainMode("")).toBe(EMAIL_DOMAIN_MANUAL);
  });

  it("keeps the known domain list available for the picker", () => {
    expect(EMAIL_DOMAINS).toContain("naver.com");
    expect(EMAIL_DOMAINS).toContain("gmail.com");
  });
});
