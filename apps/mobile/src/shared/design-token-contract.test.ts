import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
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

const conversationalActionEnding = /(?:게요|래요|까요|했어요)[.!?]?$/;

function actionCopyViolations(): string[] {
  const violations: string[] = [];

  for (const path of sourceFiles.filter((file) => file.endsWith(".tsx"))) {
    const sourceText = readFileSync(path, "utf8");
    const sourceFile = ts.createSourceFile(
      path,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );

    function checkText(text: string, node: ts.Node) {
      const normalized = text.trim();
      if (normalized && conversationalActionEnding.test(normalized)) {
        const line =
          sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
            .line + 1;
        violations.push(
          `${relative(MOBILE_ROOT, path)}:${line} ${JSON.stringify(normalized)}`,
        );
      }
    }

    function checkExpression(node: ts.Node) {
      if (
        ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node)
      ) {
        checkText(node.text, node);
      } else if (ts.isTemplateExpression(node)) {
        checkText(`${node.head.text}${node.templateSpans.at(-1)?.literal.text ?? ""}`, node);
      }
      ts.forEachChild(node, checkExpression);
    }

    function visit(node: ts.Node) {
      if (ts.isJsxElement(node)) {
        const tagName = node.openingElement.tagName.getText(sourceFile);
        if (tagName === "Button") {
          for (const child of node.children) {
            if (ts.isJsxText(child)) {
              checkText(child.text, child);
            } else if (ts.isJsxExpression(child) && child.expression) {
              checkExpression(child.expression);
            }
          }
        }
      }

      if (ts.isJsxOpeningLikeElement(node)) {
        for (const attribute of node.attributes.properties) {
          if (
            !ts.isJsxAttribute(attribute) ||
            !["actionLabel", "actionHint", "accessibilityLabel"].includes(
              attribute.name.getText(sourceFile),
            ) ||
            !attribute.initializer
          ) {
            continue;
          }

          if (ts.isStringLiteral(attribute.initializer)) {
            checkText(attribute.initializer.text, attribute.initializer);
          } else if (
            ts.isJsxExpression(attribute.initializer) &&
            attribute.initializer.expression
          ) {
            checkExpression(attribute.initializer.expression);
          }
        }
      }

      if (
        ts.isCallExpression(node) &&
        node.expression.getText(sourceFile) === "Alert.alert"
      ) {
        const actions = node.arguments[2];
        if (actions && ts.isArrayLiteralExpression(actions)) {
          for (const action of actions.elements) {
            if (!ts.isObjectLiteralExpression(action)) continue;
            for (const property of action.properties) {
              if (
                ts.isPropertyAssignment(property) &&
                property.name.getText(sourceFile) === "text"
              ) {
                checkExpression(property.initializer);
              }
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }

  return violations;
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

  it("uses explicit color roles instead of legacy semantic aliases", () => {
    expect(
      filesMatching(/\bcolors\.(?:primary|danger|warning|success|info)\b/),
    ).toEqual([]);
  });

  it("respects the system reduced-motion preference", () => {
    expect(filesMatching(/\bReduceMotion\.Never\b/)).toEqual([]);
  });

  it("does not bypass the centralized Coupang CTA copy", () => {
    expect(
      filesMatching(/쿠팡에서 (?:보기|검색하기|찾아보기|둘러보기)/),
    ).toEqual([]);
  });

  it("maps common text and controls to accessible semantic color roles", () => {
    const appText = readFileSync(
      join(MOBILE_ROOT, "src", "components", "AppText.tsx"),
      "utf8",
    );
    const button = readFileSync(
      join(MOBILE_ROOT, "src", "components", "Button.tsx"),
      "utf8",
    );
    const pill = readFileSync(
      join(MOBILE_ROOT, "src", "components", "Pill.tsx"),
      "utf8",
    );

    expect(appText).toContain("primary: colors.primaryForeground");
    expect(appText).toContain("danger: colors.dangerForeground");
    expect(appText).toContain("warning: colors.warningForeground");
    expect(appText).toContain("success: colors.successForeground");
    expect(button).toContain(
      "backgroundColor: colors.actionPrimaryBackground",
    );
    expect(button).toContain("textColor: colors.dangerForeground");
    expect(pill).toContain(
      "selectedBackgroundColor: colors.actionWarningBackground",
    );
  });

  it("sources interactive sizes from the shared token package", () => {
    const theme = readFileSync(
      join(MOBILE_ROOT, "src", "shared", "theme.ts"),
      "utf8",
    );

    expect(theme).toContain("controlSize as designControlSize");
    expect(theme).toContain("export const controlSize = designControlSize");
    expect(theme).not.toContain("touchTarget");
    expect(theme).not.toMatch(/export const controlSize = \{/);
  });

  it("requires semantic kinds for empty states and avoids presentation opt-outs", () => {
    const missingKinds: string[] = [];

    for (const path of sourceFiles.filter((file) => file.endsWith(".tsx"))) {
      const source = readFileSync(path, "utf8");
      for (const match of source.matchAll(/<EmptyState\b([\s\S]*?)\/>/g)) {
        if (!/\bkind=/.test(match[1] ?? "")) {
          missingKinds.push(relative(MOBILE_ROOT, path));
        }
      }
    }

    expect(missingKinds).toEqual([]);
    expect(filesMatching(/<EmptyState\b[\s\S]*?showMascot=/)).toEqual([]);
  });

  it("keeps action labels concise while body copy stays conversational", () => {
    expect(actionCopyViolations()).toEqual([]);
  });

  it("announces form errors and returns focus to the invalid field", () => {
    const formField = readFileSync(
      join(MOBILE_ROOT, "src", "components", "FormField.tsx"),
      "utf8",
    );

    expect(formField).toContain("ref={field.ref}");
    expect(formField).toContain('accessibilityRole="alert"');
    expect(formField).toContain('accessibilityLiveRegion="polite"');
  });
});
