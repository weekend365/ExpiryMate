import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const docsRoot = path.join(root, "docs");
const allowedStatuses = new Set(["draft", "active", "deprecated", "archived"]);
const requiredMetadata = ["status", "owner", "last_reviewed", "source_of_truth"];
const freshnessDays = 90;
const ignoredDirectories = new Set([".git", ".pnpm-store", "node_modules"]);
const errors = [];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (ignoredDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(absolute)));
    else files.push(absolute);
  }

  return files;
}

function relative(file) {
  return path.relative(root, file).replaceAll(path.sep, "/");
}

function parseFrontMatter(source, file) {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  if (lines[0] !== "---") {
    errors.push(`${relative(file)}: front matter가 없습니다.`);
    return {};
  }

  const end = lines.indexOf("---", 1);
  if (end === -1) {
    errors.push(`${relative(file)}: front matter 종료 구분자가 없습니다.`);
    return {};
  }

  const metadata = {};
  for (const line of lines.slice(1, end)) {
    const match = line.match(/^([a-z_]+):\s*(.+?)\s*$/);
    if (match) metadata[match[1]] = match[2];
  }
  return metadata;
}

function checkMetadata(file, source) {
  const metadata = parseFrontMatter(source, file);
  for (const key of requiredMetadata) {
    if (!metadata[key]) errors.push(`${relative(file)}: '${key}' 값이 필요합니다.`);
  }

  if (metadata.status && !allowedStatuses.has(metadata.status)) {
    errors.push(`${relative(file)}: 알 수 없는 status '${metadata.status}'입니다.`);
  }
  if (metadata.source_of_truth && !["true", "false"].includes(metadata.source_of_truth)) {
    errors.push(`${relative(file)}: source_of_truth는 true 또는 false여야 합니다.`);
  }

  if (!metadata.last_reviewed) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(metadata.last_reviewed)) {
    errors.push(`${relative(file)}: last_reviewed는 YYYY-MM-DD 형식이어야 합니다.`);
    return;
  }

  const reviewed = new Date(`${metadata.last_reviewed}T00:00:00Z`);
  if (Number.isNaN(reviewed.getTime())) {
    errors.push(`${relative(file)}: last_reviewed 날짜가 유효하지 않습니다.`);
    return;
  }

  const ageDays = Math.floor((Date.now() - reviewed.getTime()) / 86_400_000);
  if (["active", "draft"].includes(metadata.status) && ageDays > freshnessDays) {
    errors.push(
      `${relative(file)}: 마지막 검토 후 ${ageDays}일이 지났습니다. ` +
        `내용을 검토하고 last_reviewed를 갱신하세요.`,
    );
  }
}

async function pathExists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function checkLinks(file, source) {
  const linkPattern = /\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of source.matchAll(linkPattern)) {
    let target = match[1].trim();
    if (!target || target.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;

    target = target.split("#", 1)[0].split("?", 1)[0];
    if (!target) continue;
    if (target.startsWith("<") && target.endsWith(">")) target = target.slice(1, -1);

    try {
      target = decodeURIComponent(target);
    } catch {
      errors.push(`${relative(file)}: URL 인코딩이 잘못된 링크 '${match[1]}'입니다.`);
      continue;
    }

    const resolved = target.startsWith("/")
      ? path.join(root, target.slice(1))
      : path.resolve(path.dirname(file), target);
    if (!(await pathExists(resolved))) {
      errors.push(`${relative(file)}: 존재하지 않는 링크 대상 '${match[1]}'입니다.`);
    }
  }
}

const allMarkdown = (await walk(root)).filter((file) => file.endsWith(".md"));
const docsMarkdown = allMarkdown.filter((file) => file.startsWith(`${docsRoot}${path.sep}`));

for (const file of docsMarkdown) {
  checkMetadata(file, await readFile(file, "utf8"));
}

for (const file of allMarkdown) {
  await checkLinks(file, await readFile(file, "utf8"));
}

if (errors.length > 0) {
  console.error(`문서 검사 실패 (${errors.length}건)`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`문서 검사 통과: metadata ${docsMarkdown.length}개, links ${allMarkdown.length}개`);
}

