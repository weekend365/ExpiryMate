import fs from "node:fs";
import path from "node:path";
import { createHash, createPublicKey, verify } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import {readMasterSet, masterSetPath} from "./jango-master-set.mjs";
import { screenLineMouth } from "./jango-line-mouth-screen.mjs";
import { screenOpenMouth } from "./jango-open-mouth-screen.mjs";

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
  if(!fs.existsSync(local(directory)))return [];
  return fs.readdirSync(local(directory), { withFileTypes: true }).flatMap((entry) => {
    assert(!entry.isSymbolicLink(), "Symlinks not allowed");
    const file = `${directory}/${entry.name}`;
    return entry.isDirectory() ? filesIn(file) : [file];
  }).sort();
}
export function policy() {
  const rules = readJson(`${quality}/rules.json`);
  assert.equal(rules.version, 5);
  validateReferences(rules);
  return rules;
}
export function validateReferences(rules) {
  const set=readMasterSet();
  assert.equal(fileHash(masterSetPath),rules.masterSet.sha256,'MASTER registry changed');
  const representative=set.entries.find(e=>e.number===set.representative);
  assert.equal(rules.master.file,representative.source,'Representative mismatch');
  assert.equal(fileHash(rules.master.file),rules.master.sha256,'MASTER hash mismatch');
  assert.deepEqual(Object.keys(rules.styleProfiles),['handdrawn-crayon']);
  assert.equal(rules.defaultStyleProfile,'handdrawn-crayon');
  for(const [mode,number]of Object.entries(set.mouthReferences)){
    const entry=set.entries.find(e=>e.number===number),ref=rules.mouthReferences[mode];
    assert.equal(ref.file,entry.source,'Mouth reference mismatch');
    assert.equal(ref.sha256,entry.sourceSHA256,'Mouth hash mismatch');
    assert.deepEqual(ref.mouthRoi,entry.inspection.mouthRoi,'Reference ROI changed');
  }
  assert.deepEqual(rules.openMouthReference,rules.mouthReferences['speak-open']);
  for(const ref of Object.values(rules.compositionReferences))assert.equal(fileHash(ref.file),ref.sha256,'Composition reference hash mismatch');
  const profile=rules.styleProfiles['handdrawn-crayon'];
  for(const ref of [profile.palette,profile.styleMaster,profile.selection])assert.equal(fileHash(ref.file),ref.sha256,'Style reference hash mismatch');
  assert.equal(profile.styleMaster.file,representative.source);
}
export function validateInputLineage(input,seen=new Set()) {
  assert(!seen.has(input),'Cyclic input lineage');seen.add(input);
  const set=readMasterSet();
  if(set.entries.some(e=>e.source===input))return;
  const entry=filesIn(`${quality}/candidates`).filter(f=>f.endsWith('.json')).map(readJson).find(c=>c.source===input);
  assert(entry&&entry.disposition==='candidate'&&entry.generationRecord,'Input must be a v18 MASTER or registered derivative');
  const generation=readJson(entry.generationRecord),prepared=readJson(entry.preflight);
  assert.equal(generation.source,input,'Generation source mismatch');
  assert.equal(generation.sourceSHA256,fileHash(input),'Derived source changed');
  assert.equal(generation.preflight,entry.preflight,'Generation preparation mismatch');
  assert.equal(generation.preflightSHA256,fileHash(entry.preflight),'Derived preparation changed');
  assert.equal(generation.promptSHA256,fileHash(prepared.prompt),'Derived prompt changed');
  assert.equal(prepared.policyVersion,5,'Retired preparation cannot create new lineage');
  assert.equal(prepared.inputSHA256,fileHash(prepared.input),'Derived input changed');
  for(const ref of prepared.references)assert.equal(fileHash(ref),prepared.referenceHashes[ref],'Derived reference changed');
  assert.deepEqual(generation.actualReferences,prepared.references.map(file=>({file,sha256:prepared.referenceHashes[file]})));
  validateInputLineage(prepared.input,seen);
}
export function styleProfile(rules, name) {
  assert(Object.hasOwn(rules.styleProfiles, name), "Unknown style profile");
  return rules.styleProfiles[name];
}
export function contextBinding(rules = policy(), name = rules.defaultStyleProfile) {
  const profile = styleProfile(rules, name);
  return {
    masterSet:fileHash(masterSetPath), rules: fileHash(`${quality}/rules.json`), master: fileHash(rules.master.file),
    implementation: fileHash("scripts/jango-design-gate.mjs"),
    masterSetImplementation: fileHash("scripts/jango-master-set.mjs"),
    lineMouthImplementation: fileHash("scripts/jango-line-mouth-screen.mjs"),
    openMouthImplementation: fileHash("scripts/jango-open-mouth-screen.mjs"),
    openMouthReference: fileHash(rules.openMouthReference.file),
    mouthReferences:Object.fromEntries(Object.entries(rules.mouthReferences).map(([mode,ref])=>[mode,fileHash(ref.file)])),
    styleProfile: name,
    styleResources: Object.fromEntries([profile.directionReference, profile.palette, profile.styleMaster, profile.selection].filter(Boolean).map(({file}) => [file, fileHash(file)])),
    documents: Object.fromEntries([...new Set([...rules.documents, ...profile.documents])].map((file) => [file, fileHash(file)])),
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
export function screenMouth(png, roi, rules, master = readPng(rules.mouthReferences['idle-u'].file)) {
  const samples = rules.mouthScreen.thresholds.map((threshold) => {
    const measured = measureMouth(png, roi, threshold, rules.mouthScreen.alphaMin);
    const reference = measureMouth(master, rules.mouthReferences['idle-u'].mouthRoi, threshold, rules.mouthScreen.alphaMin);
    const ambiguous = measured.components !== 1 || measured.touchesEdge || measured.pixels < rules.mouthScreen.minPixels;
    const closed = measured.holes > rules.mouthScreen.maxHolePixels;
    const filled = measured.fill > rules.mouthScreen.maxFillRatio || measured.fill > reference.fill * rules.mouthScreen.maxFillRelativeToMaster;
    return { threshold, ...measured, referenceFill: reference.fill, status: ambiguous ? "needs-review" : closed || filled ? "fail" : "pass", reason: ambiguous ? "unmeasurable-or-ambiguous" : closed ? "closed-outline" : filled ? "filled-mouth" : "mouth-screen-only" };
  });
  const statuses = new Set(samples.map((x) => x.status));
  return { status: statuses.size === 1 ? samples[0].status : "needs-review", samples };
}
export function screenMouthMode(png, roi, rules, mode = "idle-u") {
  assert(Object.hasOwn(rules.mouthModes, mode), "Unknown mouth mode");
  return mode === "speak-open"
    ? screenOpenMouth(png, roi, rules, readPng(rules.openMouthReference.file), measureMouth)
    : mode === "neutral-line" || mode === "sad-arc"
      ? screenLineMouth(png, roi, rules, mode, measureMouth)
      : screenMouth(png, roi, rules);
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
export function visibleBounds(png) {
  let left=png.width, top=png.height, right=-1, bottom=-1;
  for(let y=0;y<png.height;y++) for(let x=0;x<png.width;x++) if(png.data[(y*png.width+x)*4+3]>2) {
    left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);
  }
  return right<0 ? null : {left,top,right,bottom,margin:Math.min(left,top,png.width-1-right,png.height-1-bottom)};
}
export function styleTechnical(sticker, source) {
  const result=technical(sticker), bounds=visibleBounds(sticker), sourceBounds=visibleBounds(source);
  const safeMargin=Boolean(bounds && bounds.margin>=8), sourceUnclipped=Boolean(sourceBounds && sourceBounds.margin>0);
  return {...result,status:result.status==='pass' && safeMargin && sourceUnclipped?'pass':'fail',safeMargin,sourceUnclipped,bounds,sourceBounds};
}
export function validateComposition(rules, composition) {
  if(composition===null) return;
  assert(composition && typeof composition.file==='string','Composition file required');
  const registered=Object.values(rules.compositionReferences??{}).find(r=>r.file===composition.file);
  assert(registered,'Unregistered composition reference');
  assert(Number.isInteger(composition.panel)&&composition.panel>=1&&composition.panel<=registered.panels,'Invalid composition panel');
  assert.equal(fileHash(registered.file),registered.sha256,'Composition reference hash mismatch');
}
export function attachmentPlan(rules,id,input,mouthMode,name,composition=null) {
  validateComposition(rules,composition);
  validateInputLineage(input);
  const profile=styleProfile(rules,name);
  const raw=[
    {role:'identity-master',file:rules.master.file},
    ...(profile.styleMaster?[{role:'style-master',file:profile.styleMaster.file}]:[]),
    {role:'edit-target',file:input},
    ...(composition?[{role:'composition-reference',file:composition.file,panel:composition.panel}]:[]),
    {role:mouthMode==='speak-open'?'speak-mouth':'mouth-reference',file:rules.mouthReferences[mouthMode].file},

  ];
  const references=[...new Set(raw.map(r=>r.file))];
  assert(references.length<=5,'At most 5 distinct image attachments allowed');
  return {references,referenceRoles:raw.map(r=>({...r,imageIndex:references.indexOf(r.file)+1}))};
}
function diagnosticReferences(rules,id,name) {
  const profile=styleProfile(rules,name);
  return [{role:'mouth-detail',file:`${quality}/jobs/${id}/master-mouth.png`},...(profile.directionReference?[{role:'style-direction-origin',file:profile.directionReference.file,panel:profile.directionReference.panel}]:[])];
}
const validId = (id) => assert(typeof id === "string" && /^[a-z0-9][a-z0-9-]{0,63}$/.test(id), "Invalid job ID");
export const masterIds=()=>readMasterSet().entries.map(e=>'v18-'+String(e.number).padStart(2,'0'));
export function auditMaster(id) {
  const set=readMasterSet(),entry=set.entries.find(e=>'v18-'+String(e.number).padStart(2,'0')===id);
  assert(entry,'Unknown MASTER');const rules=policy(),context=contextBinding(rules),inspection=entry.inspection;
  const candidate={id,kind:'emoticon',styleProfile:set.styleProfile,directory:'design/jango/emoticons/kakao-32/v18',source:entry.source,sticker:entry.sticker,mouthMode:entry.mouthMode,mouthRoi:inspection.mouthRoi,tiltDegrees:inspection.tiltDegrees,visibility:inspection.visibility,disposition:'candidate',masterNumber:entry.number};
  const mouth=screenMouthMode(readPng(entry.source),inspection.mouthRoi,rules,entry.mouthMode);
  if(inspection.visibility!=='clear'||Math.abs(inspection.tiltDegrees)>rules.mouthScreen.maxTiltDegrees)mouth.status='needs-review';
  const payload={candidate,context,assets:set.assets,adoption:fileHash(masterSetPath),historicalRecord:fileHash(entry.creationRecord)};
  return {id,binding:sha(canonical(payload)),...payload,mouth,historicalMouthStatus:entry.historicalMouthStatus,technical:styleTechnical(readPng(entry.sticker),readPng(entry.source)),preparation:'master-adoption',designStatus:'user-selected-master; signed release pending',note:'Immutable user-selected MASTER; original preparation remains closed history, never retroactively passed.'};
}
export function audit(id) {
  validId(id);
  if(/^v18-\d{2}$/.test(id))return auditMaster(id);
  const rules = policy(), candidate = readJson(`${quality}/candidates/${id}.json`);
  assert.equal(candidate.id, id);
  const kind=candidate.kind??'emoticon', name=candidate.styleProfile??'handdrawn-crayon';
  styleProfile(rules,name);
  assert(Object.hasOwn(rules.candidateKinds,kind), 'Unknown candidate kind');
  assert(candidate.directory.startsWith(rules.candidateKinds[kind]) && candidate.directory!=="design/jango/emoticons/kakao-32/v18", "Candidate directory must match kind");
  local(candidate.directory);
  for (const file of [candidate.source, candidate.sticker]) assert(file.startsWith(`${candidate.directory}/`), "Asset outside candidate directory");
  assert(["candidate", "rejected"].includes(candidate.disposition), "Candidates cannot self-approve");
  const context = contextBinding(rules,name), assets = Object.fromEntries(filesIn(candidate.directory).map((file) => [file, fileHash(file)]));
  const mouthMode = candidate.mouthMode ?? "idle-u";
  const mouth = screenMouthMode(readPng(candidate.source), candidate.mouthRoi, rules, mouthMode);
  if (candidate.visibility !== "clear" || !Number.isFinite(candidate.tiltDegrees) || Math.abs(candidate.tiltDegrees) > rules.mouthScreen.maxTiltDegrees) mouth.status = "needs-review";
  let preparation = "missing", preparationAssets = null;
  if (candidate.preflight) {
    const prepared = readJson(candidate.preflight);
    const preparationFiles = [prepared.input, prepared.prompt, ...(prepared.references ?? []), ...(prepared.diagnosticReferences ?? []).map(ref => ref.file)];
    preparationAssets = Object.fromEntries([...new Set(preparationFiles)].filter(file => typeof file === 'string').map(file => {
      try { return [file, fileHash(file)]; } catch { return [file, null]; }
    }));
    let referencesValid=false,profileValid=false;
    try {
      const composition=prepared.composition??null;
      const expected=attachmentPlan(rules,id,prepared.input,mouthMode,name,composition);
      const diagnostics=diagnosticReferences(rules,id,name);
      referencesValid=canonical(prepared.references)===canonical(expected.references) && prepared.references.every(f=>fileHash(f)===prepared.referenceHashes?.[f]) && canonical(prepared.diagnosticReferences)===canonical(diagnostics) && diagnostics.every(r=>fileHash(r.file)===prepared.diagnosticHashes?.[r.file]);
      profileValid=(prepared.styleProfile??'handdrawn-crayon')===name && (prepared.kind??'emoticon')===kind && prepared.policyVersion===rules.version && prepared.attachmentVersion===rules.attachmentVersion && canonical(prepared.referenceRoles)===canonical(expected.referenceRoles) && canonical(composition)===canonical(candidate.composition??null);
    } catch { /* Missing or altered references are stale, never approved. */ }
    const modeValid = prepared.mouthMode === mouthMode && (mouthMode === "idle-u" || typeof prepared.mouthReason === "string" && prepared.mouthReason.trim().length > 0);
    let expressionValid = canonical(prepared.expression ?? null) === canonical(candidate.expression ?? null);
    if (prepared.expression != null || candidate.expression != null) {
      try { validateExpression(prepared.expression); validateExpression(candidate.expression); } catch { expressionValid = false; }
    }
    let inputsValid=false;
    try { inputsValid=fileHash(prepared.input)===prepared.inputSHA256 && fileHash(prepared.prompt)===prepared.promptSHA256; } catch { /* Missing preparation assets fail closed. */ }
    preparation = profileValid && expressionValid && modeValid && referencesValid && canonical(prepared.context) === canonical(context) && inputsValid && prepared.id === id ? "pass" : "stale";
  }
  const payload = { candidate, context, assets, preparation, preparationAssets, preflight: candidate.preflight ? fileHash(candidate.preflight) : null };
  return { id, binding: sha(canonical(payload)), ...payload, mouth, technical: kind==='style-reference'||name==='handdrawn-crayon'?styleTechnical(readPng(candidate.sticker),readPng(candidate.source)):technical(readPng(candidate.sticker)), preparation, designStatus: candidate.disposition === "rejected" || mouth.status === "fail" ? "fail" : "needs-review", note: "Automatic mouth pass is not full design approval. Signed visual review is required." };
}
export function assertReview(report, review, publicKey) {
  assert.equal(report.candidate.disposition, "candidate", "Rejected candidate cannot be promoted");
  if(report.preparation==='master-adoption')assert.equal(report.binding,auditMaster(report.id).binding,'MASTER adoption binding mismatch');
  else assert.equal(report.preparation, "pass", "Missing/stale generation preparation");
  assert.equal(report.mouth.status, "pass", "Mouth screen blocks release");
  assert.equal(report.technical.status, "pass", "Technical checks block release");
  assert(publicKey, "JANGO_REVIEW_PUBLIC_KEY is not configured; release blocked");
  const key = createPublicKey(publicKey);
  assert.equal(key.asymmetricKeyType, "ed25519", "Ed25519 review key required");
  const p = review.payload;
  assert(p && p.binding === report.binding && p.decision === "approved" && typeof p.reviewer === "string" && p.reviewer.trim().length > 0 && typeof p.reviewedAt === "string" && Number.isFinite(Date.parse(p.reviewedAt)), "Invalid/stale review payload");
  const rules=policy(), profile=styleProfile(rules,report.candidate.styleProfile??'handdrawn-crayon');
  for (const check of [...rules.visualChecks,...profile.visualChecks]) assert.equal(p.checks?.[check], true, `Visual check missing: ${check}`);
  assert(typeof review.signature === "string" && verify(null, Buffer.from(canonical(p)), key, Buffer.from(review.signature, "base64")), "Invalid visual review signature");
}
export function validateExpression(expression) {
  assert(expression && typeof expression === "object", "Expression specification required");
  for (const key of ["family", "eyes", "brows", "pose"]) assert(typeof expression[key] === "string" && expression[key].trim(), `Expression ${key} required`);
  assert(Number.isInteger(expression.intensity) && expression.intensity >= 1 && expression.intensity <= 3, "Expression intensity must be 1–3");
}
export function prepare(id, input, request, mouthMode = "idle-u", mouthReason = "", expression = null, options = {}) {
  validId(id); assert(typeof request === "string" && request.trim().length > 0, "Task request required");
  assert(input.startsWith("design/jango/"), "Jango input required");
  const rules = policy(), directory = `${quality}/jobs/${id}`;
  const name=options.styleProfile??rules.defaultStyleProfile, kind=options.kind??'emoticon', profile=styleProfile(rules,name);
  assert(Object.hasOwn(rules.candidateKinds,kind), 'Unknown candidate kind');
  assert(Object.hasOwn(rules.mouthModes, mouthMode), "Unknown mouth mode");
  assert(mouthMode === "idle-u" || typeof mouthReason === "string" && mouthReason.trim().length > 0, "Mouth context reason required");
  if (expression !== null) validateExpression(expression);
  assert(!fs.existsSync(local(directory)), "Job already exists; choose a new ID");
  const inputSHA256 = fileHash(input);
  assert((options.composition===undefined)===(options.panel===undefined),'Composition and panel must be specified together');
  const composition=options.composition===undefined?null:{file:options.composition,panel:options.panel};
  const attachments=attachmentPlan(rules,id,input,mouthMode,name,composition);
  fs.mkdirSync(local(directory), { recursive: true });
  const mouthReference = rules.mouthReferences[mouthMode];
  const master = readPng(mouthReference.file), [x, y, w, h] = mouthReference.mouthRoi;
  const crop = new PNG({ width: w, height: h });
  PNG.bitblt(master, crop, x, y, w, h, 0, 0);
  fs.writeFileSync(local(`${directory}/master-mouth.png`), PNG.sync.write(crop));
  const prompt = `${directory}/prompt.txt`;
  const {references,referenceRoles:roles}=attachments;
  const diagnostics=diagnosticReferences(rules,id,name);
  const text = `장고 개별 이미지 편집. 실제 첨부 파일은 아래 imageIndex에 따른다. 같은 파일은 한 번만 첨부하며 여러 역할을 가질 수 있다.\n${Object.values(rules.invariants).join("\n")}\n선택 입 모드: ${mouthMode}. ${rules.mouthModes[mouthMode]}\n선택 이유: ${mouthReason || "기본 입 유지"}\n입 전용 규칙: ${mouthMode==='speak-open'?'speak-mouth 역할의 검은 입 안과 하단 작은 분홍 혀만 사용. 입 이외의 동작은 선택한 v18 원화를 따른다.':mouthMode==='idle-u'?'09번 입 참조의 짧은 단일 U선 유지. 채움·혀·치아 없음.':'선택한 v18 입 참조의 진한 선 색·두께·입 중심을 유지하고 선택한 선형 입을 적용. U 곡률 복제·채움·혀·치아 없음. 입 중심부는 질감 구멍 없이 연결한다.'}\n스타일: ${name}. ${profile.instruction}\n실제 이미지 역할: ${canonical(roles)}\n${composition?`구성 참조는 4행 8열 보드의 ${composition.panel}번 컷만 사용한다. 번호·포스터 제목·문구·종이판·넓은 배경 색칠은 복제하지 않는다. 그림체·형태는 각 MASTER가 우선이다.`:'구성 보드 미지정.'}\n진단 자료(실제 첨부와 구분): ${canonical(diagnostics)}. 진단 확대는 실제 참조 목록과 구분한다.\n규칙 정본: ${profile.documents.join(", ")}\n표정 설계: ${expression ? canonical(expression) : "기존 명령 호환 모드"}\n작업 요청: ${request}\n출력은 글자 없는 실제 알파 투명 배경 캐릭터 한 명. 생성 결과는 후보이며 자동 승인하지 않는다.\n`;
  fs.writeFileSync(local(prompt), text);
  const record = { id, policyVersion:rules.version, attachmentVersion:rules.attachmentVersion, styleProfile:name, kind, composition, referenceRoles:roles, diagnosticReferences:diagnostics, diagnosticHashes:Object.fromEntries(diagnostics.map(r=>[r.file,fileHash(r.file)])), request, mouthMode, mouthReason, expression, input, inputSHA256, context: contextBinding(rules,name), references, referenceHashes: Object.fromEntries(references.map((f) => [f, fileHash(f)])), prompt, promptSHA256: fileHash(prompt) };
  writeJson(`${directory}/preflight.json`, record);
  return record;
}
export function check(publicKey = process.env.JANGO_REVIEW_PUBLIC_KEY) {
  const set=readMasterSet();
  const history=readJson(`${quality}/history/v18-creation/index.json`);
  assert.equal(history.status,'closed-historical-records');
  for(const record of Object.values(history.files))assert.equal(fileHash(record.archive),record.sha256,`Closed creation history changed: ${record.archive}`);
  const reports = new Map(), tracked = new Set(Object.keys(set.assets));
  for(const id of masterIds()){
    const actual=auditMaster(id);assert.equal(canonical(actual),canonical(readJson(`${quality}/reports/${id}.json`)),`Stale MASTER report: ${id}`);reports.set(id,actual);
  }
  for (const file of filesIn(`${quality}/candidates`)) {
    assert(file.endsWith(".json"), "Unexpected candidate file");
    const id = path.basename(file, ".json"), actual = audit(id);
    assert.equal(canonical(actual), canonical(readJson(`${quality}/reports/${id}.json`)), `Stale report: ${id}`);
    reports.set(id, actual);
    Object.keys(actual.assets).forEach((f) => tracked.add(f));
  }
  for (const directory of Object.values(policy().candidateKinds)) {
    const normalized=directory.replace(/\/$/,'');
    if(fs.existsSync(local(normalized))) for(const file of filesIn(normalized)) if(file.endsWith('.png')) assert(tracked.has(file), `Unregistered artwork: ${file}`);
  }
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
export function parsePrepareArgs(args) {
  const positional=[], options={};
  for(let i=0;i<args.length;i++) {
    if(!args[i].startsWith('--')) {positional.push(args[i]);continue;}
    const match=/^--(style|kind|composition|panel)(?:=(.*))?$/.exec(args[i]);
    assert(match,'Unknown prepare option');
    const key=match[1]==='style'?'styleProfile':match[1];
    assert(!Object.hasOwn(options,key),'Duplicate prepare option');
    const value=match[2]??args[++i];
    assert(typeof value==='string' && value.length>0 && !value.startsWith('--'),'Missing prepare option value');
    if(key==='panel')assert(/^[1-9][0-9]*$/.test(value),'Invalid composition panel');
    options[key]=key==='panel'?Number(value):value;
  }
  assert(positional.length>=2 && positional.length<=5,'Prepare expects input, request, optional mode, reason, expression JSON');
  return {positional,options};
}
function main([command, id, ...args]) {
  if (command === "prepare") {
    const {positional:p,options}=parsePrepareArgs(args);
    console.log(JSON.stringify(prepare(id,p[0],p[1],p[2],p[3],p[4]?readJson(p[4]):null,options),null,2));return;
  }
  if (command === "audit") {
    const report = audit(id); writeJson(`${quality}/reports/${id}.json`, report);
    console.log(`${id}: mouth=${report.mouth.status}, technical=${report.technical.status}, design=${report.designStatus}, preparation=${report.preparation}`);
    if (report.mouth.status !== "pass" || report.technical.status !== "pass" || !["pass", "master-adoption"].includes(report.preparation) || report.candidate.disposition === "rejected") process.exitCode = 1;
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
  throw new Error("Usage: prepare <id> <input> <request> [idle-u|speak-open|neutral-line|sad-arc] [reason] [expression.json] [--style handdrawn-crayon] [--kind emoticon|style-reference] [--composition <file> --panel <1-32>] | audit <id> | check | promote <id> <signed-review.json> | export");
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
