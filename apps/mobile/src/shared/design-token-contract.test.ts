import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const MOBILE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function findSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory()
      ? findSourceFiles(path)
      : /\.(ts|tsx)$/.test(path)
        ? [path]
        : [];
  });
}

const sourceFiles = [join(MOBILE_ROOT, "app"), join(MOBILE_ROOT, "src")]
  .flatMap(findSourceFiles)
  .filter((path) => !path.endsWith("design-token-contract.test.ts"));

function filesMatching(pattern: RegExp): string[] {
  return sourceFiles
    .filter((path) => pattern.test(readFileSync(path, "utf8")))
    .map((path) => relative(MOBILE_ROOT, path));
}

describe("mobile design token contract", () => {
  it("does not declare raw colors in product UI", () => {
    expect(filesMatching(/#[0-9a-f]{3,8}\b/i)).toEqual([]);
  });

  it("does not bypass typography roles with numeric metrics or weights", () => {
    const rawTypography = filesMatching(
      /(?:fontSize|lineHeight):\s*\d+|fontWeight:\s*["']\d+["']/,
    );

    expect(rawTypography).toEqual([]);
  });

  it("does not bypass spacing and radius scales with numeric values", () => {
    const rawLayout = filesMatching(
      /(?:padding|paddingHorizontal|paddingVertical|margin|marginTop|marginBottom|marginLeft|marginRight|gap|borderRadius):\s*\d+/,
    );

    expect(rawLayout).toEqual([]);
  });
});
