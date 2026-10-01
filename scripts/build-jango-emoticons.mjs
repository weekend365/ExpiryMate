// Build review candidates only. Does not promote, export, or touch app assets.
import fs from "node:fs";
import {readMasterSet} from "./jango-master-set.mjs";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { root, local, readJson, readPng, fileHash, writeJson, technical } from "./jango-design-gate.mjs";
import { resizePremultiplied } from "../apps/mobile/scripts/build-mascot-runtime-assets.mjs";
import { titleFor, validatePlan, validateLayout, cropFor, placement } from "./jango-emoticon-layout.mjs";

const require = createRequire(path.join(root, "apps/mobile/package.json"));
const { PNG } = require("pngjs");
const base = process.argv.find((a) => a.startsWith("--base="))?.slice(7) ?? "design/jango/emoticons/kakao-32/v18";
assert(/^design\/jango\/emoticons\/kakao-32\/v\d+$/.test(base), "Canonical version directory required");
if(base==='design/jango/emoticons/kakao-32/v18'){readMasterSet();console.log('v18 MASTER bytes verified; immutable sources and outputs are not overwritten.');process.exit(0);}
const version = path.basename(base);
const plan = readJson(`${base}/plan.json`);
validatePlan(plan);
const selections = readJson(`${base}/selection.json`);
const changeRecord = fs.existsSync(local(`${base}/change-record.json`)) ? readJson(`${base}/change-record.json`) : null;
const partial = process.argv.includes("--partial");
const only = process.argv.find(a => a.startsWith('--only='))?.slice(7).split(',').map(Number);
const canvas = (width, height = width) => new PNG({ width, height, colorType: 6 });
const save = (file, png) => {
  fs.mkdirSync(path.dirname(local(file)), { recursive: true });
  fs.writeFileSync(local(file), PNG.sync.write(png, { colorType: 6 }));
};
function composite(target, image, left = 0, top = 0) {
  assert(left >= 0 && top >= 0 && left + image.width <= target.width && top + image.height <= target.height);
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
    const s = (y * image.width + x) * 4, d = ((top + y) * target.width + left + x) * 4;
    const a = image.data[s + 3] / 255, b = target.data[d + 3] / 255, alpha = a + b * (1 - a);
    for (let c = 0; c < 3; c++) target.data[d + c] = alpha ? Math.round((image.data[s + c] * a + target.data[d + c] * b * (1 - a)) / alpha) : 0;
    target.data[d + 3] = Math.round(alpha * 255);
  }
}
function bounds(png, alpha = 2) {
  let left = png.width, top = png.height, right = -1, bottom = -1;
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) if (png.data[(y * png.width + x) * 4 + 3] > alpha) {
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  return right >= left ? [left, top, right + 1, bottom + 1] : null;
}
const records = [];
for (const p of plan) {
  if (only && !only.includes(p.n)) continue;
  const name = String(p.n).padStart(2, "0"), selection = selections[name];
  const sourceFile = `${base}/${selection.source}`;
  if (!fs.existsSync(local(sourceFile)) && partial) continue;
  const preflight = `design/jango/quality/jobs/${selection.jobId}/preflight.json`, prepared = readJson(preflight);
  assert.equal(fileHash(prepared.input), prepared.inputSHA256);
  assert.equal(fileHash(prepared.prompt), prepared.promptSHA256);
  assert.equal(prepared.mouthMode, p.mouthMode, `Mouth mode mismatch ${name}`);
  const source = readPng(sourceFile), box = bounds(source);
  if(selection.operation==='layout-lettering-only') assert.equal(fileHash(sourceFile),selection.originSHA256,`Reused source changed ${name}`);
  assert(box, `Empty source ${name}`);
  const layout = validateLayout(p, source);
  const sourceClipped = box[0] === 0 || box[1] === 0 || box[2] === source.width || box[3] === source.height;
  if (layout) assert(!sourceClipped, `Source clipped ${name}; regenerate source rather than hiding clipping in framing`);
  const [cx,cy,cw,ch] = cropFor(box,source,layout);
  const crop = [cx,cy,cx+cw,cy+ch];
  const tight = canvas(crop[2]-crop[0], crop[3]-crop[1]);
  PNG.bitblt(source, tight, crop[0], crop[1], tight.width, tight.height, 0, 0);
  const fit = (w, h) => {
    const scale = Math.min(w/tight.width, h/tight.height);
    return resizePremultiplied(tight, Math.max(1, Math.round(tight.width*scale)), Math.max(1, Math.round(tight.height*scale)));
  };
  const character = canvas(1024), centered = fit(944, 944);
  composite(character, centered, Math.floor((1024-centered.width)/2), Math.floor((1024-centered.height)/2));
  save(`${base}/characters/${name}.png`, character);
  const letters = readPng(`${base}/lettering/${name}.png`), letterBox = bounds(letters);
  assert.equal(letters.width,1024); assert.equal(letters.height,1024);
  assert.equal(Boolean(letterBox), Boolean(p.line), `Missing/unexpected lettering ${name}`);
  const art = canvas(1024), artTop = letterBox ? letterBox[3]+32 : 40, bottom = 984;
  const at = placement(tight.width,tight.height,layout?.characterBox ?? [40,artTop,944,bottom-artTop]);
  const framed = resizePremultiplied(tight,at.width,at.height);
  composite(art, framed, at.x, at.y);
  let overlap = 0;
  for (let i=3;i<art.data.length;i+=4) if (art.data[i]>100 && letters.data[i]>100) overlap++;
  assert.equal(overlap, 0, `Caption collision ${name}`);
  save(`${base}/artwork/${name}.png`, art);
  const merged = canvas(1024); composite(merged, art); composite(merged, letters);
  const sticker = resizePremultiplied(merged, 360, 360);
  save(`${base}/stickers/${name}.png`, sticker);
  save(`${base}/thumbs/${name}.png`, resizePremultiplied(merged, 120, 120));
  assert.equal(technical(sticker).status, "pass", `Technical failure ${name}`);
  const sb = bounds(sticker), minMargin = Math.min(sb[0],sb[1],360-sb[2],360-sb[3]);
  assert(minMargin >= 8, `Insufficient margin ${name}: ${minMargin}`);
  records.push({styleProfile:prepared.styleProfile,composition:prepared.composition,referenceRoles:prepared.referenceRoles,referenceHashes:prepared.referenceHashes,mouthMode:p.mouthMode,operation:selection.operation,origin:selection.origin,number:p.n,title:titleFor(p),line:p.line,captionKind:p.captionKind,layout,letteringSHA256:fileHash(`${base}/lettering/${name}.png`),file:`stickers/${name}.png`,source:sourceFile,sourceSHA256:fileHash(sourceFile),sha256:fileHash(`${base}/stickers/${name}.png`),width:360,height:360,bytes:fs.statSync(local(`${base}/stickers/${name}.png`)).size,minMargin,captionArtOverlapPixels:overlap,sourceClipped,sourceSize:[source.width,source.height],sourceCrop:crop,preflight,status:"candidate",designApproval:"needs-review"});
}
if (!partial) assert.equal(records.length, 32);
writeJson(`${base}/manifest.json`, records);
writeJson(`${base}/production-record.json`, {version,status:"candidate",fullSet:records.length===32,count:records.length,method:changeRecord?.method ?? "Individual image edits from the v18 MASTER set; separate Gaegu lettering and deterministic layout",builder:"scripts/build-jango-emoticons.mjs",letteringBuilder:"scripts/render-jango-lettering.jxa.js",plan:`${base}/plan.json`,designApproval:"Independent signed visual review required; no release adopted",records});
if (records.length === 32) {
  for (const [name,rgb] of [["light",[245,246,240]],["dark",[41,58,49]]]) {
    const sheet = canvas(1920,960);
    for (let i=0;i<sheet.data.length;i+=4) sheet.data.set([...rgb,255],i);
    for (const r of records) composite(sheet,resizePremultiplied(readPng(`${base}/${r.file}`),224,224),((r.number-1)%8)*240+8,Math.floor((r.number-1)/8)*240+8);
    save(`${base}/preview-${name}.png`,sheet);
  }
  const small = canvas(1024,512);
  for (let i=0;i<small.data.length;i+=4) small.data.set([245,246,240,255],i);
  for (const r of records) composite(small,readPng(`${base}/thumbs/${String(r.number).padStart(2,"0")}.png`),((r.number-1)%8)*128+4,Math.floor((r.number-1)/8)*128+4);
  save(`${base}/preview-120.png`,small);
}
console.log(`Built ${records.length}/32 candidate stickers; transparent edges, 8px margins and no text/art overlap verified.`);
