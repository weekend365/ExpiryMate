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
reportMatches(
  adminFiles.filter((file) => extname(file) === ".tsx"),
  "admin/use-spacing-roles",
  /\b(?:space-[xy]|gap|p[trblxy]?|m[trblxy]?)-\d+(?:\.\d+)?\b/,
  "Admin 간격은 --space-* 공유 토큰을 사용하세요.",
);
reportMatches(
  adminFiles.filter((file) => extname(file) === ".tsx"),
  "admin/use-typography-roles",
  /\b(?:text-(?:xs|sm|base|lg|xl|2xl|3xl|4xl)|font-(?:medium|semibold|bold|black)|leading-\d+)\b/,
  "Admin 타이포그래피는 type-* 공유 역할을 사용하세요.",
);
reportMatches(
  adminFiles.filter((file) => extname(file) === ".tsx"),
  "admin/use-content-width-roles",
  /\bmax-w-(?:sm|md|lg|xl|[2-7]xl)\b/,
  "Admin 콘텐츠 폭은 --content-* 공유 토큰을 사용하세요.",
);

const sharedCssTokenPath = resolve(
  REPOSITORY_ROOT,
  "packages",
  "shared",
  "src",
  "design",
  "css.ts",
);
const sharedCssTokenSource = readFileSync(sharedCssTokenPath, "utf8");
const definedCssVariables = new Set(
  [...sharedCssTokenSource.matchAll(/["'](--[a-z0-9-]+)["']\s*:/gi)].map(
    (match) => match[1],
  ),
);
for (const file of adminFiles) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const match of line.matchAll(/var\((--[a-z0-9-]+)/gi)) {
      if (!definedCssVariables.has(match[1])) {
        violations.push({
          file: relative(REPOSITORY_ROOT, file),
          line: index + 1,
          rule: "admin/no-undefined-css-variable",
          explanation: `${match[1]} 공유 CSS 변수가 정의되어 있지 않습니다.`,
        });
      }
    }
  });
}

const adminGlobalsPath = resolve(
  REPOSITORY_ROOT,
  "apps",
  "admin",
  "app",
  "globals.css",
);
if (
  !readFileSync(adminGlobalsPath, "utf8").includes(
    "min-height: var(--control-minimum)",
  )
) {
  violations.push({
    file: relative(REPOSITORY_ROOT, adminGlobalsPath),
    line: 1,
    rule: "admin/minimum-control-height",
    explanation: "Admin 입력 컨트롤은 공유 최소 조작 높이를 사용하세요.",
  });
}

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
reportMatches(
  mobileFiles.filter((file) => file !== mobileThemePath),
  "mobile/no-legacy-color-alias",
  /\bcolors\.(?:primary|danger|warning|success|info)\b/,
  "모바일 색상은 foreground, accent, action 역할 중 하나를 명시하세요.",
);
reportMatches(
  mobileFiles,
  "mobile/respect-reduced-motion",
  /\bReduceMotion\.Never\b/,
  "애니메이션은 시스템의 동작 줄이기 설정을 따라야 합니다.",
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
