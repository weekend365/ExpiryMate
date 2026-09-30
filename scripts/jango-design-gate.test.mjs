import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { generateKeyPairSync, sign } from "node:crypto";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import {
  root, quality, policy, readPng, screenMouth, technical, canonical,
  local, prepare, writeJson, audit, check, assertReview, promote,
} from "./jango-design-gate.mjs";
import { resizePremultiplied } from "../apps/mobile/scripts/build-mascot-runtime-assets.mjs";

const require = createRequire(path.join(root, "apps/mobile/package.json"));
const { PNG } = require("pngjs");
const rules = policy(), master = readPng(rules.master.file);
test("actual MASTER U mouth passes at all three thresholds", () => {
  const report = screenMouth(master, rules.master.mouthRoi, rules);
  assert.equal(report.status, "pass");
  assert(report.samples.every((r) => r.holes === 0));
});
test("actual v11 filled mouth fails despite valid sticker dimensions", () => {
  const report = audit("02-v11");
  assert.equal(report.mouth.status, "fail");
  assert(report.mouth.samples.every((r) => r.reason === "filled-mouth"));
  assert.equal(report.technical.status, "pass");
  assert.equal(report.designStatus, "fail");
});
test("actual first generated outlined mouth fails hole detection", () => {
  const report = screenMouth(readPng(`${quality}/fixtures/02-outlined-mouth.png`), [596, 743, 97, 77], rules);
  assert.equal(report.status, "fail");
  assert(report.samples.every((r) => r.reason === "closed-outline"));
});
test("empty, cropped and ambiguous ROIs never pass", () => {
  assert.equal(screenMouth(master, [0, 0, 80, 80], rules).status, "needs-review");
  assert.equal(screenMouth(master, [500, 530, 20, 25], rules).status, "needs-review");
  assert.throws(() => screenMouth(master, [-1, 0, 80, 80], rules), /ROI/);
  assert.throws(() => screenMouth(master, [0, 0, 0, 0], rules), /ROI/);
});
test("empty or opaque output fails technical checks", () => {
  assert.equal(technical(new PNG({ width: 360, height: 360 })).status, "fail");
  const png = new PNG({ width: 360, height: 360 }); png.data.fill(255);
  assert.equal(technical(png).status, "fail");
});
test("repository paths cannot escape or traverse symlinks", () => {
  assert.throws(() => local("../outside"));
  assert.throws(() => local("/tmp/outside"));
  assert.throws(() => local("design/jango/emoticons/../../quality"));
});
test("failed historical candidates cannot self-approve or export", () => {
  assert.throws(() => assertReview(audit("02-v11"), { approved: true }, ""), /Rejected/);
  const process = spawnSync("node", ["scripts/jango-design-gate.mjs", "export"], { cwd: root, encoding: "utf8" });
  assert.equal(process.status, 1);
  assert.match(process.stderr, /No approved assets/);
});
test("prepared candidate: valid signature, forgery, stale assets, stale prompt and uncertain pose", () => {
  const id = `gate-test-${process.pid}`;
  const directory = `design/jango/emoticons/kakao-32/${id}`;
  const candidateFile = `${quality}/candidates/${id}.json`, reportFile = `${quality}/reports/${id}.json`;
  const releasesBefore = fs.readFileSync(local(`${quality}/releases.json`));
  try {
    const prepared = prepare(id, rules.master.file, "손짓만 수정하고 MASTER 입선을 유지");
    assert.deepEqual(prepared.references.slice(0, 2), [rules.master.file, rules.master.file]);
    assert.throws(() => prepare(id, rules.master.file, "다시"), /already exists/);
    fs.mkdirSync(local(directory), { recursive: true });
    fs.copyFileSync(local(rules.master.file), local(`${directory}/source.png`));
    fs.writeFileSync(local(`${directory}/sticker.png`), PNG.sync.write(resizePremultiplied(master, 360, 360)));
    const candidate = { id, directory, source: `${directory}/source.png`, sticker: `${directory}/sticker.png`, mouthRoi: rules.master.mouthRoi, tiltDegrees: 0, visibility: "clear", disposition: "candidate", preflight: `${quality}/jobs/${id}/preflight.json` };
    writeJson(candidateFile, candidate);
    const report = audit(id); writeJson(reportFile, report);
    assert.equal(report.preparation, "pass");
    assert.equal(report.mouth.status, "pass");
    assert.equal(report.designStatus, "needs-review", "Mouth pass never self-approves full design");
    const keys = generateKeyPairSync("ed25519");
    const publicKey = keys.publicKey.export({ type: "spki", format: "pem" });
    const payload = { binding: report.binding, decision: "approved", reviewer: "test-reviewer", reviewedAt: "2026-09-30", checks: Object.fromEntries(rules.visualChecks.map((c) => [c, true])) };
    const review = { payload, signature: sign(null, Buffer.from(canonical(payload)), keys.privateKey).toString("base64") };
    assert.doesNotThrow(() => assertReview(report, review, publicKey));
    promote(id, review, publicKey);
    assert(check(publicKey).entries.some((entry) => entry.id === id));
    assert.throws(() => promote(id, review, publicKey), /Already released/);
    assert.throws(() => assertReview(report, { approved: true }, publicKey), /payload/);
    assert.throws(() => assertReview(report, review, ""), /not configured/);
    const wrong = generateKeyPairSync("ed25519").publicKey.export({ type: "spki", format: "pem" });
    assert.throws(() => assertReview(report, review, wrong), /signature/);
    assert.throws(() => assertReview(report, { ...review, payload: { ...payload, reviewer: "forged" } }, publicKey), /signature/);
    assert.throws(() => assertReview(report, { ...review, payload: { ...payload, checks: {} } }, publicKey), /Visual check/);
    for (const altered of [
      { ...report, preparation: "stale" },
      { ...report, mouth: { status: "needs-review" } },
      { ...report, technical: { status: "fail" } },
    ]) assert.throws(() => assertReview(altered, review, publicKey));
    const modified = readPng(`${directory}/sticker.png`);
    modified.data[(180 * 360 + 180) * 4] ^= 1;
    fs.writeFileSync(local(`${directory}/sticker.png`), PNG.sync.write(modified));
    const changed = audit(id);
    assert.notEqual(changed.binding, report.binding);
    assert.throws(() => assertReview(changed, review, publicKey), /stale/);
    assert.throws(() => check(), /Stale report/);
    fs.appendFileSync(local(prepared.prompt), "変更");
    assert.equal(audit(id).preparation, "stale");
    writeJson(candidateFile, { ...candidate, tiltDegrees: 45 });
    assert.equal(audit(id).mouth.status, "needs-review");
    writeJson(candidateFile, { ...candidate, visibility: "occluded" });
    assert.equal(audit(id).mouth.status, "needs-review");
    writeJson(candidateFile, { ...candidate, disposition: "approved" });
    assert.throws(() => audit(id), /self-approve/);
  } finally {
    fs.writeFileSync(local(`${quality}/releases.json`), releasesBefore);
    for (const file of [candidateFile, reportFile]) fs.rmSync(local(file), { force: true });
    for (const dir of [directory, `${quality}/jobs/${id}`]) fs.rmSync(local(dir), { recursive: true, force: true });
  }
});
test("unregistered image is rejected by repository gate", () => {
  const file = "design/jango/emoticons/unregistered-test.png";
  try { fs.copyFileSync(local(rules.master.file), local(file)); assert.throws(() => check(), /Unregistered/); }
  finally { fs.rmSync(local(file), { force: true }); }
});
