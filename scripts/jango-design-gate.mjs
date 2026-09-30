import fs from "node:fs";
import path from "node:path";
import { createHash, createPublicKey, verify } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const quality = "design/jango/quality";
const require = createRequire(path.join(root, "apps/mobile/package.json"));
const { PNG } = require("pngjs");
export const canonical = (value) => JSON.stringify(value, (_, v) => v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v);
export const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
export function local(file) {
  assert(typeof file === "string" && !path.isAbsolute(file), "Repository-relative path required");
  assert(file === path.posix.normalize(file) && !file.split("/").includes("..") && !file.includes("\\"), "Canonical repository path required");
  const resolved = path.resolve(root, file);
  assert(resolved.startsWith(`${root}${path.sep}`), "Path escapes repository");
  let parent = resolved;
  while (!fs.existsSync(parent)) parent = path.dirname(parent);
  assert(fs.realpathSync(parent) === parent, "Symlink paths are not allowed");
  return resolved;
}
export const readJson = (file) => JSON.parse(fs.readFileSync(local(file), "utf8"));
export const fileHash = (file) => sha(fs.readFileSync(local(file)));
export const readPng = (file) => PNG.sync.read(fs.readFileSync(local(file)));
export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(local(file)), { recursive: true });
  fs.writeFileSync(local(file), `${JSON.stringify(value, null, 2)}\n`);
}
export function filesIn(directory) {
  return fs.readdirSync(local(directory), { withFileTypes: true }).flatMap((entry) => {
    assert(!entry.isSymbolicLink(), "Symlinks not allowed");
    const file = `${directory}/${entry.name}`;
    return entry.isDirectory() ? filesIn(file) : [file];
  }).sort();
}
export function policy() {
  const rules = readJson(`${quality}/rules.json`);
  assert.equal(rules.version, 1);
  assert.equal(fileHash(rules.master.file), rules.master.sha256, "MASTER hash mismatch");
  return rules;
}
export function contextBinding(rules = policy()) {
  return {
    rules: fileHash(`${quality}/rules.json`), master: fileHash(rules.master.file),
    implementation: fileHash("scripts/jango-design-gate.mjs"),
    documents: Object.fromEntries(rules.documents.map((file) => [file, fileHash(file)])),
  };
}

// This is a conservative topology/ink screen, not a semantic anatomy certificate.
export function measureMouth(png, roi, threshold, alphaMin) {
  assert(Array.isArray(roi) && roi.length === 4 && roi.every(Number.isInteger), "Integer mouth ROI required");
  const [x0, y0, w, h] = roi;
  assert(w >= 8 && h >= 8 && x0 >= 0 && y0 >= 0 && x0 + w <= png.width && y0 + h <= png.height, "Invalid mouth ROI");
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = ((y0 + y) * png.width + x0 + x) * 4;
    mask[y * w + x] = Number(png.data[p + 3] > alphaMin && Math.max(...png.data.subarray(p, p + 3)) < threshold);
  }
  const neighbors = (i) => [i % w > 0 ? i - 1 : -1, i % w < w - 1 ? i + 1 : -1, i >= w ? i - w : -1, i < w * (h - 1) ? i + w : -1].filter((n) => n >= 0);
  const seen = new Set(), components = [];
  for (let i = 0; i < mask.length; i++) if (mask[i] && !seen.has(i)) {
    const points = [i]; seen.add(i);
    for (let at = 0; at < points.length; at++) for (const n of neighbors(points[at])) if (mask[n] && !seen.has(n)) { seen.add(n); points.push(n); }
    if (points.length >= 5) components.push(points);
  }
  components.sort((a, b) => b.length - a.length);
  if (!components.length) return { pixels: 0, components: 0, fill: 0, holes: 0, touchesEdge: false };
  const points = components[0], xs = points.map((i) => i % w), ys = points.map((i) => Math.floor(i / w));
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const exterior = new Set(), queue = [];
  for (let i = 0; i < mask.length; i++) if (!mask[i] && (i % w === 0 || i % w === w - 1 || i < w || i >= w * (h - 1))) { exterior.add(i); queue.push(i); }
  for (let at = 0; at < queue.length; at++) for (const n of neighbors(queue[at])) if (!mask[n] && !exterior.has(n)) { exterior.add(n); queue.push(n); }
  let holes = 0;
  for (let i = 0; i < mask.length; i++) if (!mask[i] && !exterior.has(i)) holes++;
  return { pixels: points.length, components: components.length, fill: points.length / ((maxX - minX + 1) * (maxY - minY + 1)), holes, touchesEdge: minX === 0 || minY === 0 || maxX === w - 1 || maxY === h - 1 };
}
export function screenMouth(png, roi, rules, master = readPng(rules.master.file)) {
  const samples = rules.mouthScreen.thresholds.map((threshold) => {
    const measured = measureMouth(png, roi, threshold, rules.mouthScreen.alphaMin);
    const reference = measureMouth(master, rules.master.mouthRoi, threshold, rules.mouthScreen.alphaMin);
    const ambiguous = measured.components !== 1 || measured.touchesEdge || measured.pixels < rules.mouthScreen.minPixels;
    const closed = measured.holes > rules.mouthScreen.maxHolePixels;
    const filled = measured.fill > rules.mouthScreen.maxFillRatio || measured.fill > reference.fill * rules.mouthScreen.maxFillRelativeToMaster;
    return { threshold, ...measured, referenceFill: reference.fill, status: ambiguous ? "needs-review" : closed || filled ? "fail" : "pass", reason: ambiguous ? "unmeasurable-or-ambiguous" : closed ? "closed-outline" : filled ? "filled-mouth" : "mouth-screen-only" };
  });
  const statuses = new Set(samples.map((x) => x.status));
  return { status: statuses.size === 1 ? samples[0].status : "needs-review", samples };
}
export function technical(png) {
  let visible = false, transparentEdge = true;
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
    const a = png.data[(y * png.width + x) * 4 + 3];
    visible ||= a > 128;
    if ((x === 0 || y === 0 || x === png.width - 1 || y === png.height - 1) && a !== 0) transparentEdge = false;
  }
  return { status: visible && transparentEdge && png.width === 360 && png.height === 360 ? "pass" : "fail", visible, transparentEdge, width: png.width, height: png.height };
}
const validId = (id) => assert(typeof id === "string" && /^[a-z0-9][a-z0-9-]{0,63}$/.test(id), "Invalid job ID");
export function audit(id) {
  validId(id);
  const rules = policy(), candidate = readJson(`${quality}/candidates/${id}.json`);
  assert.equal(candidate.id, id);
  assert(candidate.directory.startsWith("design/jango/emoticons/") && !candidate.directory.includes("/v10"), "Candidate must have a new emoticon directory");
  for (const file of [candidate.source, candidate.sticker]) assert(file.startsWith(`${candidate.directory}/`), "Asset outside candidate directory");
  assert(["candidate", "rejected"].includes(candidate.disposition), "Candidates cannot self-approve");
  const context = contextBinding(rules), assets = Object.fromEntries(filesIn(candidate.directory).map((file) => [file, fileHash(file)]));
  const mouth = screenMouth(readPng(candidate.source), candidate.mouthRoi, rules);
  if (candidate.visibility !== "clear" || !Number.isFinite(candidate.tiltDegrees) || Math.abs(candidate.tiltDegrees) > rules.mouthScreen.maxTiltDegrees) mouth.status = "needs-review";
  let preparation = "missing";
  if (candidate.preflight) {
    const prepared = readJson(candidate.preflight);
    const referencesValid = Array.isArray(prepared.references) && prepared.references.length === 3 && prepared.references[0] === rules.master.file && prepared.references[1] === prepared.input && prepared.references.every((f) => fileHash(f) === prepared.referenceHashes?.[f]);
    preparation = referencesValid && canonical(prepared.context) === canonical(context) && fileHash(prepared.input) === prepared.inputSHA256 && fileHash(prepared.prompt) === prepared.promptSHA256 && prepared.id === id ? "pass" : "stale";
  }
  const payload = { candidate, context, assets, preflight: candidate.preflight ? fileHash(candidate.preflight) : null };
  return { id, binding: sha(canonical(payload)), ...payload, mouth, technical: technical(readPng(candidate.sticker)), preparation, designStatus: candidate.disposition === "rejected" || mouth.status === "fail" ? "fail" : "needs-review", note: "Automatic mouth pass is not full design approval. Signed visual review is required." };
}
export function assertReview(report, review, publicKey) {
  assert.equal(report.candidate.disposition, "candidate", "Rejected candidate cannot be promoted");
  assert.equal(report.preparation, "pass", "Missing/stale generation preparation");
  assert.equal(report.mouth.status, "pass", "Mouth screen blocks release");
  assert.equal(report.technical.status, "pass", "Technical checks block release");
  assert(publicKey, "JANGO_REVIEW_PUBLIC_KEY is not configured; release blocked");
  const key = createPublicKey(publicKey);
  assert.equal(key.asymmetricKeyType, "ed25519", "Ed25519 review key required");
  const p = review.payload;
  assert(p && p.binding === report.binding && p.decision === "approved" && typeof p.reviewer === "string" && p.reviewer.trim().length > 0 && typeof p.reviewedAt === "string" && Number.isFinite(Date.parse(p.reviewedAt)), "Invalid/stale review payload");
  for (const check of policy().visualChecks) assert.equal(p.checks?.[check], true, `Visual check missing: ${check}`);
  assert(typeof review.signature === "string" && verify(null, Buffer.from(canonical(p)), key, Buffer.from(review.signature, "base64")), "Invalid visual review signature");
}
export function prepare(id, input, request) {
  validId(id); assert(typeof request === "string" && request.trim().length > 0, "Task request required");
  assert(input.startsWith("design/jango/"), "Jango input required");
  const rules = policy(), directory = `${quality}/jobs/${id}`;
  assert(!fs.existsSync(local(directory)), "Job already exists; choose a new ID");
  const inputSHA256 = fileHash(input);
  fs.mkdirSync(local(directory), { recursive: true });
  const master = readPng(rules.master.file), [x, y, w, h] = rules.master.mouthRoi;
  const crop = new PNG({ width: w, height: h });
  PNG.bitblt(master, crop, x, y, w, h, 0, 0);
  fs.writeFileSync(local(`${directory}/master-mouth.png`), PNG.sync.write(crop));
  const prompt = `${directory}/prompt.txt`;
  const text = `장고 편집 작업. MASTER를 이미지 1, 수정 대상을 이미지 2로 실제 첨부한다.\n${Object.values(rules.invariants).join("\n")}\n규칙 정본: ${rules.documents.join(", ")}\n아래 요청은 고정 규칙 안에서만 해석한다. 충돌하는 표현은 고정 규칙을 유지하고 몸짓으로 풀어낸다.\n작업 요청: ${request}\n출력은 글자 없는 투명 배경 캐릭터. 생성 결과는 후보이며 자동 승인하지 않는다.\n`;
  fs.writeFileSync(local(prompt), text);
  const references = [rules.master.file, input, `${directory}/master-mouth.png`];
  const record = { id, request, input, inputSHA256, context: contextBinding(rules), references, referenceHashes: Object.fromEntries(references.map((f) => [f, fileHash(f)])), prompt, promptSHA256: fileHash(prompt) };
  writeJson(`${directory}/preflight.json`, record);
  return record;
}
export function check(publicKey = process.env.JANGO_REVIEW_PUBLIC_KEY) {
  const legacy = readJson(`${quality}/legacy-v10.json`);
  const baseline = Object.fromEntries(filesIn("design/jango/emoticons/kakao-32/v10").map((f) => [f, fileHash(f)]));
  assert.equal(canonical(baseline), canonical(legacy.files), "Historical v10 changed; use a new candidate directory");
  const reports = new Map(), tracked = new Set(Object.keys(baseline));
  for (const file of filesIn(`${quality}/candidates`)) {
    assert(file.endsWith(".json"), "Unexpected candidate file");
    const id = path.basename(file, ".json"), actual = audit(id);
    assert.equal(canonical(actual), canonical(readJson(`${quality}/reports/${id}.json`)), `Stale report: ${id}`);
    reports.set(id, actual);
    Object.keys(actual.assets).forEach((f) => tracked.add(f));
  }
  for (const file of filesIn("design/jango/emoticons")) if (file.endsWith(".png")) assert(tracked.has(file), `Unregistered artwork: ${file}`);
  const releases = readJson(`${quality}/releases.json`);
  assert.equal(releases.version, 1); assert(Array.isArray(releases.entries));
  const seen = new Set();
  for (const entry of releases.entries) {
    assert(!seen.has(entry.id), "Duplicate release"); seen.add(entry.id);
    const report = reports.get(entry.id); assert(report, "Unknown release candidate");
    assertReview(report, entry.review, publicKey);
  }
  return releases;
}
export function promote(id, review, publicKey = process.env.JANGO_REVIEW_PUBLIC_KEY) {
  check(publicKey);
  const report = audit(id);
  assertReview(report, review, publicKey);
  const releases = readJson(`${quality}/releases.json`);
  assert(!releases.entries.some((r) => r.id === id), "Already released");
  releases.entries.push({ id, review }); writeJson(`${quality}/releases.json`, releases);
}
function main([command, id, ...args]) {
  if (command === "prepare") { console.log(JSON.stringify(prepare(id, args[0], args[1]), null, 2)); return; }
  if (command === "audit") {
    const report = audit(id); writeJson(`${quality}/reports/${id}.json`, report);
    console.log(`${id}: mouth=${report.mouth.status}, technical=${report.technical.status}, design=${report.designStatus}, preparation=${report.preparation}`);
    if (report.mouth.status !== "pass" || report.technical.status !== "pass" || report.preparation !== "pass" || report.candidate.disposition === "rejected") process.exitCode = 1;
    return;
  }
  if (command === "check") { const r = check(); console.log(`Jango gate: records valid; ${r.entries.length} signed releases. Candidates are not approved.`); return; }
  if (command === "promote") { promote(id, readJson(args[0])); console.log(`Signed release registered: ${id}`); return; }
  if (command === "export") {
    const releases = check(); assert(releases.entries.length > 0, "No approved assets; export blocked");
    const destination = local("output/jango-approved"); assert(!fs.existsSync(destination), "Export directory exists; preserve previous export");
    fs.mkdirSync(destination, { recursive: true });
    for (const entry of releases.entries) fs.copyFileSync(local(audit(entry.id).candidate.sticker), path.join(destination, `${entry.id}.png`));
    console.log("Exported signed releases to output/jango-approved"); return;
  }
  throw new Error("Usage: prepare <id> <input> <request> | audit <id> | check | promote <id> <signed-review.json> | export");
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
