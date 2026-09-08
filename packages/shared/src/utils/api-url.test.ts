import { describe, expect, it } from "vitest";
import { isUnsafeProductionHostname, resolveApiBaseUrl } from "./api-url";

describe("API base URL contract", () => {
  const resolve = (value: string | undefined, production = true) =>
    resolveApiBaseUrl({ value, production, variableName: "PUBLIC_API_URL" });

  it("preserves the development fallback and single trailing-slash removal", () => {
    expect(resolve(undefined, false)).toBe("http://localhost:4000");
    expect(resolve("", false)).toBe("");
    expect(resolve("http://localhost:4000/api/", false)).toBe("http://localhost:4000/api");
    expect(resolve("http://localhost:4000/api//", false)).toBe("http://localhost:4000/api/");
  });

  it("accepts public HTTPS base paths without normalizing their spelling", () => {
    expect(resolve("https://API.jango.devnamu.com/v1/")).toBe("https://API.jango.devnamu.com/v1");
  });

  it.each([undefined, ""])("requires a production URL (%s)", (value) => {
    expect(() => resolve(value)).toThrow("PUBLIC_API_URL is required in production.");
  });

  it.each([
    "invalid-url", "http://api.jango.devnamu.com", "https://localhost",
    "https://127.0.0.1", "https://api.localhost", "https://api.local",
    "https://api.example", "https://api.invalid", "https://api.test",
    "https://your-domain.com",
  ])("preserves production rejection for %s", (value) => {
    expect(() => resolve(value)).toThrow("PUBLIC_API_URL must be a public https:// URL in production.");
  });

  it("preserves the hostname policy without broadening it", () => {
    expect(isUnsafeProductionHostname("LOCALHOST")).toBe(true);
    expect(isUnsafeProductionHostname("::1")).toBe(true);
    expect(isUnsafeProductionHostname("localhost.com")).toBe(false);
    expect(isUnsafeProductionHostname("api.jango.devnamu.com")).toBe(false);
  });
});
