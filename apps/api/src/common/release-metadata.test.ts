import { describe, expect, it } from "vitest";
import { getReleaseMetadata } from "./release-metadata";

describe("server release identity", () => {
  it("prefers an explicitly supplied build identity", () => {
    expect(getReleaseMetadata({ APP_VERSION: " 1.4.3 ", GIT_SHA: " explicit ", RAILWAY_GIT_COMMIT_SHA: "railway" }))
      .toEqual({ version: "1.4.3", gitSha: "explicit" });
  });

  it.each([undefined, "", "   ", "unknown"])("uses the Railway GitHub deployment SHA when Docker has %j", GIT_SHA => {
    expect(getReleaseMetadata({ GIT_SHA, RAILWAY_GIT_COMMIT_SHA: "deploy-commit" }).gitSha).toBe("deploy-commit");
  });

  it("keeps local and non-Git deployment identity honest", () => {
    expect(getReleaseMetadata({})).toEqual({ version: "0.1.0", gitSha: "unknown" });
  });
});
