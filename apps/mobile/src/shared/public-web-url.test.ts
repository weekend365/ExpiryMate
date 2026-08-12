import { afterEach, describe, expect, it } from "vitest";
import {
  getPublicWebBaseUrl,
  publicWebUrl,
} from "./public-web-url";

const ORIGINAL_WEB = process.env.EXPO_PUBLIC_WEB_BASE_URL;
const ORIGINAL_API = process.env.EXPO_PUBLIC_API_BASE_URL;

afterEach(() => {
  if (ORIGINAL_WEB === undefined) {
    delete process.env.EXPO_PUBLIC_WEB_BASE_URL;
  } else {
    process.env.EXPO_PUBLIC_WEB_BASE_URL = ORIGINAL_WEB;
  }

  if (ORIGINAL_API === undefined) {
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
  } else {
    process.env.EXPO_PUBLIC_API_BASE_URL = ORIGINAL_API;
  }
});

describe("publicWebUrl", () => {
  it("prefers EXPO_PUBLIC_WEB_BASE_URL", () => {
    process.env.EXPO_PUBLIC_WEB_BASE_URL = "https://example.com/";
    process.env.EXPO_PUBLIC_API_BASE_URL = "https://api.example.com/api";

    expect(getPublicWebBaseUrl()).toBe("https://example.com");
    expect(publicWebUrl("/privacy")).toBe("https://example.com/privacy");
  });

  it("falls back to API host without /api", () => {
    delete process.env.EXPO_PUBLIC_WEB_BASE_URL;
    process.env.EXPO_PUBLIC_API_BASE_URL = "https://jango.devnamu.com/api";

    expect(publicWebUrl("terms")).toBe("https://jango.devnamu.com/terms");
  });

  it("uses the production marketing host when nothing is configured", () => {
    delete process.env.EXPO_PUBLIC_WEB_BASE_URL;
    delete process.env.EXPO_PUBLIC_API_BASE_URL;

    expect(publicWebUrl("/privacy")).toBe(
      "https://jango.devnamu.com/privacy",
    );
  });
});
