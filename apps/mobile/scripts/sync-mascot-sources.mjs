import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import {readMasterSet, masterHash, masterSetPath} from "../../../scripts/jango-master-set.mjs";
import { resizePremultiplied } from "./build-mascot-runtime-assets.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const sourceDir = path.resolve(scriptDir, "../../../design/jango");
export const charactersDir = path.resolve(scriptDir, "../assets/characters");
export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
export function readManifest() {
  const manifest = JSON.parse(fs.readFileSync(path.join(sourceDir, "manifest.json"), "utf8"));
  if (manifest.version !== 3) throw new Error("Unsupported Jango source manifest version");
  const set=readMasterSet();
  if(manifest.masterSet.sha256!==masterHash(masterSetPath))throw new Error('MASTER registry changed');
  for(const pose of manifest.poses){
    const number=pose.mood==='icon-crop'?24:set.appMoods[pose.mood];
    const entry=set.entries.find(e=>e.number===number);
    if(!entry||pose.masterNumber!==number||'design/jango/'+pose.source!==entry.source||pose.sha256!==entry.sourceSHA256)throw new Error('Runtime mapping must use selected v18 MASTER');
  }
  return manifest;
}

export function alphaBounds(png) {
  const bounds = [png.width, png.height, -1, -1];
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      if (png.data[(y * png.width + x) * 4 + 3] <= 2) continue;
      bounds[0] = Math.min(bounds[0], x);
      bounds[1] = Math.min(bounds[1], y);
      bounds[2] = Math.max(bounds[2], x);
      bounds[3] = Math.max(bounds[3], y);
    }
  }
  return bounds;
}

export function assertTransparentPadding(png, label) {
  if (!png.alpha) throw new Error(`${label}: RGBA required`);
  let visible = false;
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const alpha = png.data[(y * png.width + x) * 4 + 3];
      if ((x === 0 || y === 0 || x === png.width - 1 || y === png.height - 1) && alpha !== 0) {
        throw new Error(`${label}: clipped or nontransparent canvas edge`);
      }
      visible ||= alpha > 128;
    }
  }
  if (!visible) throw new Error(`${label}: empty artwork`);
}

export function deriveMaster(source, entry) {
  if (source.width !== source.height || source.width !== entry.sourceSize) {
    throw new Error(`${entry.mood}: source size/aspect ratio changed`);
  }
  if (entry.alphaFloor !== 2) throw new Error(`${entry.mood}: invalid alpha floor`);
  const clean = new PNG({ width: source.width, height: source.height });
  clean.alpha = source.alpha;
  source.data.copy(clean.data);
  // Only discard documented <=2/255 background dust; never edit the stored original.
  for (let i = 3; i < clean.data.length; i += 4) if (clean.data[i] <= entry.alphaFloor) clean.data.fill(0, i - 3, i + 1);
  assertTransparentPadding(clean, entry.mood);
  if(entry.transform!=='uniform-content-fit'||entry.outputSize!==1024)throw new Error('Unsupported v18 transform');
  const [left,top,right,bottom]=alphaBounds(clean),width=right-left+1,height=bottom-top+1;
  const crop=new PNG({width,height});PNG.bitblt(clean,crop,left,top,width,height,0,0);
  const scale=900/Math.max(width,height);
  const resized=resizePremultiplied(crop,Math.round(width*scale),Math.round(height*scale));
  const output=new PNG({width:1024,height:1024});
  PNG.bitblt(resized,output,0,0,resized.width,resized.height,Math.floor((1024-resized.width)/2),Math.floor((1024-resized.height)/2));
  output.alpha = true; // Newly constructed PNGs do not set the decoder-only alpha flag.
  assertTransparentPadding(output, entry.mood);
  return output;
}

export function assertSamePixels(actual, expected, label) {
  if (actual.width !== expected.width || actual.height !== expected.height ||
      !Buffer.from(actual.data).equals(Buffer.from(expected.data))) {
    throw new Error(`${label}: stale, distorted or edited derivative; run mascot:sync and mascot:build`);
  }
}

export function expectedMaster(entry) {
  const bytes = fs.readFileSync(path.join(sourceDir, entry.source));
  if (sha256(bytes) !== entry.sha256) throw new Error(`${entry.mood}: source hash changed; review artwork and provenance`);
  return deriveMaster(PNG.sync.read(bytes), entry);
}

export function syncMascotSources({ check = false } = {}) {
  const manifest = readManifest();
  const expectedMoods = ["idle", "happy", "worry", "cooking", "empty", "speak", "think", "point", "icon-crop"];
  if (JSON.stringify(manifest.poses.map((pose) => pose.mood).sort()) !== JSON.stringify(expectedMoods.sort())) {
    throw new Error("Manifest must contain exactly eight moods and the 24 representative icon pose");
  }
  // Validate every input before touching any existing master.
  const outputs = manifest.poses.map((entry) => ({ entry, png: expectedMaster(entry) }));
  for (const { entry, png } of outputs) {
    const destination = path.join(charactersDir, `jango-${entry.mood}.png`);
    if (check) assertSamePixels(PNG.sync.read(fs.readFileSync(destination)), png, entry.mood);
    else fs.writeFileSync(destination, PNG.sync.write(png, { colorType: 6, inputColorType: 6, inputHasAlpha: true }));
    console.log(`${check ? "PASS" : "SYNC"} ${entry.mood}: ${entry.sourceSize} → 1024, uniform content fit`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  syncMascotSources({ check: process.argv.includes("--check") });
}
