import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appConfig = JSON.parse(
  readFileSync(resolve(scriptDir, "../app.json"), "utf8"),
);

describe("Android adaptive-window app configuration", () => {
  it("does not request a global portrait lock", () => {
    expect(appConfig.expo.orientation).toBe("default");
  });
});
