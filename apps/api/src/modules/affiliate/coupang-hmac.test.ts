import { describe, expect, it } from "vitest";
import {
  createCoupangAuthorization,
  formatCoupangSignedDate,
} from "./coupang-hmac";

describe("Coupang HMAC signing", () => {
  it("formats GMT signed dates as yyMMddTHHmmssZ", () => {
    expect(
      formatCoupangSignedDate(new Date("2026-08-16T08:44:09.000Z")),
    ).toBe("260816T084409Z");
  });

  it("signs method, path, and query with the secret key", () => {
    const authorization = createCoupangAuthorization({
      method: "POST",
      pathWithQuery: "/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink",
      accessKey: "access-key",
      secretKey: "secret-key",
      signedAt: new Date("2026-08-16T08:44:09.000Z"),
    });

    expect(authorization).toContain("CEA algorithm=HmacSHA256");
    expect(authorization).toContain("access-key=access-key");
    expect(authorization).toContain("signed-date=260816T084409Z");
    expect(authorization).toMatch(/signature=[0-9a-f]{64}$/);
  });

  it("signs the exact encoded Korean query including spaces and special characters", () => {
    const authorization = createCoupangAuthorization({
      method: "GET",
      pathWithQuery:
        "/v2/providers/affiliate_open_api/apis/openapi/v1/products/search?keyword=%EB%8C%80%ED%8C%8C+%26+%EC%86%8C%EA%B8%88&limit=10",
      accessKey: "access-key",
      secretKey: "secret-key",
      signedAt: new Date("2026-08-16T08:44:09.000Z"),
    });

    expect(authorization).toContain(
      "signature=4c23e03245a2c860977f0978283531773fd107cf2cdafd0c867a9053387e32e7",
    );
  });
});
