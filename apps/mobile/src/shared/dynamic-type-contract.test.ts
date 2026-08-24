import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const MOBILE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function findTsxFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory()
      ? findTsxFiles(path)
      : path.endsWith(".tsx")
        ? [path]
        : [];
  });
}

describe("dynamic type component contract", () => {
  it("routes editable text through AppTextInput", () => {
    const files = [join(MOBILE_ROOT, "app"), join(MOBILE_ROOT, "src")]
      .flatMap(findTsxFiles)
      .filter((path) => !path.endsWith("AppTextInput.tsx"));

    const rawInputs = files
      .filter((path) => /^\s*<TextInput\b/m.test(readFileSync(path, "utf8")))
      .map((path) => relative(MOBILE_ROOT, path));

    expect(rawInputs).toEqual([]);
  });

  it("keeps onboarding copy as native text instead of store-art text", () => {
    const onboarding = readFileSync(join(MOBILE_ROOT, "app", "onboarding.tsx"), "utf8");

    expect(onboarding).not.toContain("jango-appstore-space-copy");
    expect(onboarding).toContain('variant="heading"');
  });
});
