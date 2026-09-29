import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { sha256, sourceDir, readManifest } from "./sync-mascot-sources.mjs";

export const methodVersion = "outer-door-roi-v1";
export const targets = { empty: "listless", worry: "worried", speak: "speaking", point: "neutral", "icon-crop": "wink" };
export const measurementDir = path.join(sourceDir, "measurements");
const scriptPath = fileURLToPath(import.meta.url);
const biblePath = path.join(sourceDir, "reference/JANGO-CHARACTER-BIBLE-v1.md");
const featureNames = ["leftEye", "rightEye", "mouth", "leftCheek", "rightCheek"];
const sides = ["left", "right", "top", "bottom"];
const round = (n) => Math.round(n * 1e6) / 1e6;
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const dark = (r, g, b, a) => a > 220 && Math.max(r, g, b) < 100;
// Pale green cheek fill, deliberately excluding the saturated mint parts.
const cheek = (r, g, b, a) => a > 220 && r >= 175 && r <= 225 && g >= 200 && g <= 240 && b >= 180 && b <= 225 && g - r >= 8 && g - b >= 5;

export function validateInput(input) {
  if (input.version !== 1 || input.method !== methodVersion || !Array.isArray(input.poses)) throw new Error("Unsupported anatomy input");
  const names = input.poses.map((pose) => pose.mood).sort();
  if (JSON.stringify(names) !== JSON.stringify(Object.keys(targets).sort())) throw new Error("Anatomy input must contain exactly the five target poses, without duplicates");
  for (const pose of input.poses) {
    if (pose.expression !== targets[pose.mood]) throw new Error(`${pose.mood}: wrong expression class`);
    if (pose.expression === "wink" && !["leftEye", "rightEye"].includes(pose.winkEye)) throw new Error("Wink eye must be explicitly annotated");
    if (!pose.reviewedAt || !pose.notes) throw new Error(`${pose.mood}: visual annotation provenance missing`);
    if (pose.uncertaintyPx !== 3 * pose.size[0] / 1024) throw new Error("Use the BIBLE ±3px observation uncertainty scaled to source resolution");
  }
}

function pixelsIn(png, roi, predicate) {
  if (!Array.isArray(roi) || roi.length !== 4 || !roi.every(Number.isInteger)) throw new Error("ROI must be four integer pixel boundaries");
  const [x0, y0, x1, y1] = roi;
  if (x0 < 0 || y0 < 0 || x1 > png.width || y1 > png.height || x0 >= x1 || y0 >= y1) throw new Error("ROI outside source");
  const points = [];
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * png.width + x) * 4;
    if (predicate(...png.data.subarray(i, i + 4))) points.push([x, y]);
  }
  return points;
}

function components(points, width) {
  const remaining = new Set(points.map(([x, y]) => y * width + x));
  const result = [];
  while (remaining.size) {
    const first = remaining.values().next().value;
    const queue = [first];
    remaining.delete(first);
    const points = [];
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i], x = p % width, y = Math.floor(p / width);
      points.push([x, y]);
      for (const neighbor of [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p - width, p + width]) {
        if (remaining.delete(neighbor)) queue.push(neighbor);
      }
    }
    result.push(points);
  }
  return result.sort((a, b) => b.length - a.length);
}

function edgePoints(png, roi, side) {
  const points = pixelsIn(png, roi, dark);
  const scanAxis = ["top", "bottom"].includes(side) ? 0 : 1;
  const valueAxis = 1 - scanAxis;
  const max = ["right", "bottom"].includes(side);
  const selected = new Map();
  for (const p of points) {
    const previous = selected.get(p[scanAxis]);
    if (!previous || (max ? p[valueAxis] > previous[valueAxis] : p[valueAxis] < previous[valueAxis])) selected.set(p[scanAxis], p);
  }
  if (selected.size < 8) throw new Error(`${side}: cannot measure exterior door edge`);
  const limit = max ? roi[valueAxis + 2] - 1 : roi[valueAxis];
  if ([...selected.values()].some((p) => p[valueAxis] === limit)) throw new Error(`${side}: outer edge touches ROI boundary; inspect annotation`);
  return [...selected.values()];
}

export function localPoint([x, y], angle) {
  return [x * Math.cos(angle) + y * Math.sin(angle), -x * Math.sin(angle) + y * Math.cos(angle)];
}

export function measurePose(png, pose) {
  const edges = Object.fromEntries(sides.map((side) => [side, edgePoints(png, pose.face[side], side)]));
  // Linear fit to the selected central lower OUTER door edge. No eye-derived axis.
  const bottom = edges.bottom;
  const mx = bottom.reduce((s, p) => s + p[0], 0) / bottom.length;
  const my = bottom.reduce((s, p) => s + p[1], 0) / bottom.length;
  const denominator = bottom.reduce((s, p) => s + (p[0] - mx) ** 2, 0);
  if (!denominator) throw new Error("Cannot determine face axis");
  const slope = bottom.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) / denominator;
  const angle = Math.atan(slope);
  const residual = Math.sqrt(bottom.reduce((s, p) => s + (p[1] - my - slope * (p[0] - mx)) ** 2, 0) / bottom.length);
  const localEdges = Object.fromEntries(sides.map((side) => [side, edges[side].map((p) => localPoint(p, angle))]));
  const left = Math.min(...localEdges.left.map((p) => p[0]));
  const right = Math.max(...localEdges.right.map((p) => p[0]));
  const top = Math.min(...localEdges.top.map((p) => p[1]));
  const lower = Math.max(...localEdges.bottom.map((p) => p[1]));
  const width = right - left, height = lower - top;
  if (width <= 0 || height <= 0) throw new Error("Invalid face geometry");
  const issues = [];
  if (residual > Math.max(1, pose.uncertaintyPx)) issues.push("face: selected bottom edge is not sufficiently straight to establish an axis");
  const frame = { angle, angleDegrees: angle * 180 / Math.PI, left, right, top, bottom: lower, width, height, axisFitResidualPx: residual };
  const features = {};
  for (const name of featureNames) {
    const selection = pose.features[name];
    const groups = components(pixelsIn(png, selection.roi, name.includes("Cheek") ? cheek : dark), png.width);
    const points = groups[0] ?? [];
    const problems = [];
    if (points.length < 16) problems.push("missing or too few classified pixels");
    if (groups[1]?.length >= points.length * 0.1) problems.push("multiple significant components in ROI");
    if (points.some(([x, y]) => x === selection.roi[0] || y === selection.roi[1] || x === selection.roi[2] - 1 || y === selection.roi[3] - 1)) problems.push("feature touches ROI boundary");
    if (selection.occluded) problems.push("visually annotated occlusion");
    if (problems.length) issues.push(...problems.map((problem) => `${name}: ${problem}`));
    if (!points.length) { features[name] = { measured: null, issues: problems }; continue; }
    const local = points.map((p) => localPoint(p, angle));
    const x0 = Math.min(...local.map((p) => p[0])), x1 = Math.max(...local.map((p) => p[0]));
    const y0 = Math.min(...local.map((p) => p[1])), y1 = Math.max(...local.map((p) => p[1]));
    features[name] = { measured: { width: x1 - x0 + 1, height: y1 - y0 + 1, x: (x0 + x1) / 2 - left, y: (y0 + y1) / 2 - top }, localBounds: [x0, y0, x1, y1], pixels: points.length, issues: problems };
  }
  return { frame, features, issues, sampledEdges: edges };
}

export function classifyInterval(value, interval, allowed) {
  if (!Number.isFinite(value) || !interval.every(Number.isFinite)) return "needs-review";
  if (interval[1] < allowed[0] || interval[0] > allowed[1]) return "fail";
  if (interval[0] >= allowed[0] && interval[1] <= allowed[1]) return "pass";
  return "needs-review";
}

export function evaluatePose(measurement, pose) {
  const { frame: f, features } = measurement;
  const e = pose.uncertaintyPx;
  const metrics = [];
  function ratio(name, numerator, denominator, allowed, basis, invalid = false) {
    const value = numerator == null ? null : numerator / denominator;
    const interval = value === null ? [null, null] : [(numerator - 2 * e) / (denominator + 2 * e), (numerator + 2 * e) / (denominator - 2 * e)];
    const status = invalid || value === null || measurement.issues.some((s) => s.startsWith("face:")) ? "needs-review" : classifyInterval(value, interval, allowed);
    const nominalStatus = value === null ? "unmeasured" : value >= allowed[0] && value <= allowed[1] ? "within-range" : "outside-range";
    metrics.push({ name, value, interval, allowed, nominalStatus, status, basis });
  }
  ratio("face.width/height", f.width, f.height, [1.28 * 0.98, 1.28 * 1.02], "BIBLE §1: 1.28 ±2%", measurement.issues.some((s) => s.startsWith("face:")));
  for (const [name, cx] of [["leftEye", 0.323], ["rightEye", 0.711]]) {
    const m = features[name].measured;
    const bad = features[name].issues.length > 0;
    const closed = pose.expression === "wink" && name === pose.winkEye;
    ratio(`${name}.width/W`, m?.width, f.width, closed ? [0.10, 0.12] : [0.103 * 0.95, 0.103 * 1.05], closed ? "BIBLE §2: closed-eye curve width" : "BIBLE §2: oval width ±5%", bad);
    ratio(`${name}.height/${closed ? "F" : "W"}`, m?.height, closed ? f.height : f.width, closed ? [0.07, 0.10] : [0.158 * (pose.expression === "worried" ? 0.9 : 0.95), 0.158 * 1.05], "BIBLE §2: expression-specific eye height", bad);
    ratio(`${name}.u`, m?.x, f.width, [cx - 0.015, cx + 0.015], "BIBLE §2: horizontal center ±0.015W", bad);
    ratio(`${name}.v`, m?.y, f.height, [0.508 - 0.020, 0.508 + 0.020], "BIBLE §2: vertical center ±0.020F", bad);
  }
  const le = features.leftEye.measured, re = features.rightEye.measured;
  ratio("eyeSpacing/W", le && re ? re.x - le.x : null, f.width, [0.376, 0.400], "BIBLE §2: center spacing", features.leftEye.issues.length + features.rightEye.issues.length > 0);
  const mouth = features.mouth.measured, mouthBad = features.mouth.issues.length > 0;
  ratio("mouth.u", mouth?.x, f.width, [0.513 - 0.015, 0.513 + 0.015], "BIBLE §2: center ±0.015W", mouthBad);
  ratio("mouth.v", mouth?.y, f.height, [0.594 - 0.025, 0.594 + 0.025], "BIBLE §2: center ±0.025F", mouthBad);
  const smallFrown = ["listless", "worried"].includes(pose.expression);
  const speaking = pose.expression === "speaking";
  ratio("mouth.width/W", mouth?.width, f.width, smallFrown ? [0.09, 0.13] : speaking ? [0.10, 0.15] : [0.127 * 0.9, 0.127 * 1.1], smallFrown ? "BIBLE §2: small downturned mouth (listless uses sadness curve)" : speaking ? "BIBLE §2: speaking mouth" : "BIBLE §2: default smile ±10%", mouthBad);
  if (!smallFrown) ratio("mouth.height/F", mouth?.height, f.height, speaking ? [0.08, 0.13] : [0.086 * 0.9, 0.086 * 1.1], "BIBLE §2: speaking/default smile height", mouthBad);
  // BIBLE specifies no numeric height for the downturned curve. Record its raw
  // measured height without inventing a pass range (available in features).
  for (const [name, cx, cy] of [["leftCheek", 0.244, 0.655], ["rightCheek", 0.792, 0.657]]) {
    const m = features[name].measured, bad = features[name].issues.length > 0;
    ratio(`${name}.width/W`, m?.width, f.width, [60 / 505 * 0.9, 60 / 505 * 1.1], "BIBLE §2: 60px / 505px ±10%", bad);
    ratio(`${name}.height/F`, m?.height, f.height, [38 / 394 * 0.9, 38 / 394 * 1.1], "BIBLE §2: 38px / 394px ±10%", bad);
    ratio(`${name}.u`, m?.x, f.width, [cx - 0.015, cx + 0.015], "BIBLE §2: cheek center ±0.015W", bad);
    ratio(`${name}.v`, m?.y, f.height, [cy - 0.020, cy + 0.020], "BIBLE §2: cheek center ±0.020F", bad);
  }
  const status = metrics.some((m) => m.status === "fail") ? "fail" : measurement.issues.length || metrics.some((m) => m.status === "needs-review") ? "needs-review" : "pass";
  return { status, metrics };
}

// Diagnostic only: clone the source, then draw sampled edges, ROIs and measured
// boxes. Never write to an artwork/source/runtime directory.
export function renderOverlay(png, pose, measurement) {
  const output = new PNG({ width: png.width, height: png.height });
  png.data.copy(output.data);
  const dot = (x, y, color) => {
    x = Math.round(x); y = Math.round(y);
    if (x >= 0 && y >= 0 && x < output.width && y < output.height) output.data.set([...color, 255], (y * output.width + x) * 4);
  };
  function line(a, b, color) {
    const steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
    for (let i = 0; i <= steps; i++) dot(a[0] + (b[0] - a[0]) * i / (steps || 1), a[1] + (b[1] - a[1]) * i / (steps || 1), color);
  }
  function box([x0, y0, x1, y1], color, angle = 0) {
    const corners = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map((p) => localPoint(p, -angle));
    corners.forEach((p, i) => line(p, corners[(i + 1) % 4], color));
  }
  for (const roi of Object.values(pose.face)) box(roi, [0, 110, 255]);
  for (const points of Object.values(measurement.sampledEdges)) for (const p of points) dot(...p, [0, 255, 255]);
  const f = measurement.frame;
  box([f.left, f.top, f.right, f.bottom], [255, 0, 200], f.angle);
  for (const name of featureNames) {
    box(pose.features[name].roi, [255, 140, 0]);
    const feature = measurement.features[name];
    if (feature.localBounds) box(feature.localBounds, [220, 0, 0], f.angle);
    if (feature.measured) {
      const center = localPoint([feature.measured.x + f.left, feature.measured.y + f.top], -f.angle);
      line([center[0] - 5, center[1]], [center[0] + 5, center[1]], [220, 0, 0]);
      line([center[0], center[1] - 5], [center[0], center[1] + 5], [220, 0, 0]);
    }
  }
  return PNG.sync.write(output);
}

export function buildReport(input, manifest, readSource) {
  validateInput(input);
  const overlays = {};
  const poses = input.poses.map((pose) => {
    const entries = manifest.poses.filter((entry) => entry.mood === pose.mood);
    if (entries.length !== 1 || entries[0].sha256 !== pose.sha256 || entries[0].source !== pose.source) throw new Error(`${pose.mood}: annotation does not match the production manifest`);
    const bytes = readSource(pose.source);
    if (sha256(bytes) !== pose.sha256) throw new Error(`${pose.mood}: stale annotation/source hash`);
    const png = PNG.sync.read(bytes);
    if (JSON.stringify([png.width, png.height]) !== JSON.stringify(pose.size)) throw new Error(`${pose.mood}: source size changed`);
    const measured = measurePose(png, pose);
    const evaluated = evaluatePose(measured, pose);
    const overlay = renderOverlay(png, pose, measured);
    overlays[`${pose.mood}.png`] = overlay;
    return { ...pose, ...measured, ...evaluated, overlaySha256: sha256(overlay) };
  });
  const report = { version: 1, method: methodVersion, inputSha256: sha256(Buffer.from(json(input))), implementationSha256: sha256(fs.readFileSync(scriptPath)), bibleSha256: sha256(fs.readFileSync(biblePath)), poses };
  // Stable numeric serialization; the pass/fail decisions use unrounded values.
  return { report: JSON.parse(JSON.stringify(report, (_key, value) => typeof value === "number" ? round(value) : value)), overlays };
}

export function assertFreshReport(actual, expected) {
  if (json(actual) !== json(expected)) throw new Error("Stale or edited anatomy record; review inputs and run mascot:measure");
}

export function reportMarkdown(report) {
  const fmt = (n) => n == null ? "unmeasured" : n.toFixed(6);
  const lines = ["# 추가 포즈의 BIBLE 수치 검수", "", "`mascot:measure`로 생성한 기록. 원화 수정·자동 승인을 수행하지 않는다.", "",
    "실측값의 범위 내 여부와 오차를 고려한 최종 판정은 구분한다. ±3px/1024px의 좌표 관찰 오차를 원본 크기로 환산하고, 두 경계의 차이인 분자·분모에 각각 ±2배를 전파한 보수적 구간이다. 통계적 신뢰구간이나 원근 복원 결과는 아니다. 허용 범위는 넓히지 않는다.", "",
    "키트 포즈의 기존 측정은 ../kit-v3/manifest.json에 보존한다. 이 문서는 추가 제작한 5종만 직접 측정한 결과다.", "",
    "## 측정 입력과 시각 증거", "", "[입력·영역·원본 해시](./inputs.json) · [전체 수치·좌표·판정](./results.json) · [측정 방법과 한계](./README.md)", "",
    "겹쳐 그린 선: 파랑=외곽 선택 영역, 청록=추출한 외곽 픽셀, 자홍=얼굴 좌표틀, 주황=표정 선택 영역, 빨강=측정한 표정 경계·중심.", ""];
  for (const pose of report.poses) {
    lines.push(`## ${pose.mood}: ${pose.status}`, "", `[측정선 이미지](./overlays/${pose.mood}.png)`, "",
      `원본 SHA-256: \`${pose.sha256}\`. 얼굴 폭 ${fmt(pose.frame.width)}px, 높이 ${fmt(pose.frame.height)}px, 외곽 기준 회전 ${fmt(pose.frame.angleDegrees)}°.`, "",
      "| 항목 | 실측값 | BIBLE 범위 | 오차 구간 | 실측값 범위 내 여부 | 최종 판정 |", "| --- | ---: | --- | --- | --- | --- |");
    for (const m of pose.metrics) lines.push(`| ${m.name} | ${fmt(m.value)} | ${m.allowed.map(fmt).join("–")} | ${m.interval.map(fmt).join("–")} | ${m.nominalStatus} | ${m.status} |`);
    if (pose.issues.length) lines.push("", ...pose.issues.map((issue) => `- ${issue}`));
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

export function runMeasurement({ check = false } = {}) {
  const input = JSON.parse(fs.readFileSync(path.join(measurementDir, "inputs.json"), "utf8"));
  const { report, overlays } = buildReport(input, readManifest(), (name) => fs.readFileSync(path.join(sourceDir, name)));
  const reportPath = path.join(measurementDir, "results.json");
  const markdownPath = path.join(measurementDir, "report.md");
  if (check) {
    assertFreshReport(JSON.parse(fs.readFileSync(reportPath, "utf8")), report);
    if (fs.readFileSync(markdownPath, "utf8") !== reportMarkdown(report)) throw new Error("Stale anatomy report markdown");
    for (const [name, bytes] of Object.entries(overlays)) {
      if (!bytes.equals(fs.readFileSync(path.join(measurementDir, "overlays", name)))) throw new Error(`Stale anatomy overlay: ${name}`);
    }
  } else {
    fs.mkdirSync(path.join(measurementDir, "overlays"), { recursive: true });
    fs.writeFileSync(reportPath, json(report));
    fs.writeFileSync(markdownPath, reportMarkdown(report));
    for (const [name, bytes] of Object.entries(overlays)) fs.writeFileSync(path.join(measurementDir, "overlays", name), bytes);
  }
  for (const pose of report.poses) {
    const counts = Object.fromEntries(["pass", "fail", "needs-review"].map((s) => [s, pose.metrics.filter((m) => m.status === s).length]));
    console.log(`${pose.status.toUpperCase()} ${pose.mood}: ${JSON.stringify(counts)}, face ratio=${pose.metrics[0].value}`);
  }
  if (check && report.poses.some((pose) => pose.status !== "pass")) throw new Error("Anatomy does not fully meet BIBLE: see measurements/results.json; do not loosen limits or re-approve the artwork");
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  try { runMeasurement({ check: process.argv.includes("--check") }); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
