import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
);

const violations = [];

function sourceFiles(directory, extensions) {
  return readdirSync(directory).flatMap((entry) => {
    const path = resolve(directory, entry);
    if (statSync(path).isDirectory()) {
      return sourceFiles(path, extensions);
    }
    return extensions.has(extname(path)) ? [path] : [];
  });
}

function reportMatches(files, rule, pattern, explanation) {
  for (const file of files) {
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      if (pattern.test(line)) {
        violations.push({
          file: relative(REPOSITORY_ROOT, file),
          line: index + 1,
          rule,
          explanation,
        });
      }
      pattern.lastIndex = 0;
    });
  }
}

const adminFiles = [
  ...sourceFiles(resolve(REPOSITORY_ROOT, "apps", "admin", "app"), new Set([".ts", ".tsx", ".css"])),
  ...sourceFiles(resolve(REPOSITORY_ROOT, "apps", "admin", "src"), new Set([".ts", ".tsx", ".css"])),
];
const mobileFiles = [
  ...sourceFiles(
    resolve(REPOSITORY_ROOT, "apps", "mobile", "app"),
    new Set([".ts", ".tsx"]),
  ),
  ...sourceFiles(
    resolve(REPOSITORY_ROOT, "apps", "mobile", "src"),
    new Set([".ts", ".tsx"]),
  ),
].filter((file) => !/\.test\.(?:ts|tsx)$/.test(file));

reportMatches(
  adminFiles,
  "admin/no-raw-color",
  /#[0-9a-f]{3,8}\b/i,
  "Admin 제품 UI 색상은 공유 CSS 변수로 사용하세요.",
);
reportMatches(
  adminFiles.filter((file) => extname(file) === ".tsx"),
  "admin/no-ambiguous-foreground",
  /text-\[var\(--(?:primary|danger|warning|success|info)\)\]/,
  "작은 글자는 *-foreground 또는 link-text 역할을 사용하세요.",
);
reportMatches(
  adminFiles.filter((file) => extname(file) === ".tsx"),
  "admin/no-bright-primary-action",
  /bg-\[var\(--primary\)\]/,
  "주요 행동은 action-primary-background, 장식은 brand-accent를 사용하세요.",
);

const actionControlPath = resolve(
  REPOSITORY_ROOT,
  "apps",
  "admin",
  "src",
  "components",
  "action-control.tsx",
);
reportMatches(
  adminFiles.filter(
    (file) => extname(file) === ".tsx" && file !== actionControlPath,
  ),
  "admin/use-action-control",
  /<button\b/,
  "Admin 버튼은 공통 ActionButton을 사용하세요.",
);

const directActionRoleAllowlist = new Set([
  actionControlPath,
  resolve(
    REPOSITORY_ROOT,
    "apps",
    "admin",
    "src",
    "components",
    "affiliate-cta.tsx",
  ),
  resolve(
    REPOSITORY_ROOT,
    "apps",
    "admin",
    "src",
    "components",
    "app-shell.tsx",
  ),
]);
reportMatches(
  adminFiles.filter(
    (file) =>
      extname(file) === ".tsx" && !directActionRoleAllowlist.has(file),
  ),
  "admin/use-shared-action-style",
  /action-primary-background/,
  "내부 링크는 ActionLink, 외부 링크는 ActionAnchor를 사용하세요.",
);

const mobileThemePath = resolve(
  REPOSITORY_ROOT,
  "apps",
  "mobile",
  "src",
  "shared",
  "theme.ts",
);
const mobileTheme = readFileSync(mobileThemePath, "utf8");
reportMatches(
  mobileFiles,
  "mobile/no-touch-target-alias",
  /\btouchTarget\b/,
  "구형 touchTarget 대신 공유 controlSize를 사용하세요.",
);
if (!mobileTheme.includes("controlSize as designControlSize")) {
  violations.push({
    file: relative(REPOSITORY_ROOT, mobileThemePath),
    line: 1,
    rule: "mobile/shared-control-size",
    explanation: "모바일 조작 크기는 @expirymate/shared controlSize에서 가져오세요.",
  });
}
if (!mobileTheme.includes("export const controlSize = designControlSize")) {
  violations.push({
    file: relative(REPOSITORY_ROOT, mobileThemePath),
    line: 1,
    rule: "mobile/direct-shared-control-size",
    explanation: "모바일 controlSize는 공유 토큰을 그대로 노출해야 합니다.",
  });
}
if (violations.length > 0) {
  for (const violation of violations) {
    console.error(
      `${violation.file}:${violation.line} [${violation.rule}] ${violation.explanation}`,
    );
  }
  console.error(`Design system check failed with ${violations.length} violation(s).`);
  process.exitCode = 1;
} else {
  console.log(
    `Design system check passed (${adminFiles.length} Admin and ${mobileFiles.length} mobile source files).`,
  );
}
