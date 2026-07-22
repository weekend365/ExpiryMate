import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  assertIosTeamCompatibleWithAppEnv,
  isPersonalTeamBuild,
} = require("../../scripts/ios-team-env.cjs");

describe("ios-team-env", () => {
  it("treats EXPO_IOS_PERSONAL_TEAM=1 as personal team", () => {
    expect(isPersonalTeamBuild({ EXPO_IOS_PERSONAL_TEAM: "1" })).toBe(true);
    expect(isPersonalTeamBuild({ EXPO_IOS_PERSONAL_TEAM: "0" })).toBe(false);
    expect(isPersonalTeamBuild({})).toBe(false);
  });

  it("allows personal team only outside preview/production", () => {
    expect(() =>
      assertIosTeamCompatibleWithAppEnv({
        EXPO_IOS_PERSONAL_TEAM: "1",
        EXPO_PUBLIC_APP_ENV: "development",
      }),
    ).not.toThrow();

    expect(() =>
      assertIosTeamCompatibleWithAppEnv({
        EXPO_IOS_PERSONAL_TEAM: "0",
        EXPO_PUBLIC_APP_ENV: "production",
      }),
    ).not.toThrow();
  });

  it("rejects personal team for preview and production", () => {
    expect(() =>
      assertIosTeamCompatibleWithAppEnv({
        EXPO_IOS_PERSONAL_TEAM: "1",
        EXPO_PUBLIC_APP_ENV: "preview",
      }),
    ).toThrow(/EXPO_IOS_PERSONAL_TEAM=1/);

    expect(() =>
      assertIosTeamCompatibleWithAppEnv({
        EXPO_IOS_PERSONAL_TEAM: "1",
        EXPO_PUBLIC_APP_ENV: "production",
      }),
    ).toThrow(/Sign in with Apple/);
  });
});
