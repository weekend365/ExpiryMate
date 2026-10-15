import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const charactersDir = path.resolve(scriptDir, "../assets/characters");

export const mascotMoodConfig = JSON.parse(fs.readFileSync(path.join(charactersDir, "moods.json"), "utf8"));
export const mascotMoods = Object.keys(mascotMoodConfig);

// Both variants preserve the whole selected pose and every prop. No fixed face crop.
export const smallMasterCrop = Object.freeze({x:0,y:0,size:1024,outputSize:1024});
export function deriveSmallMaster(source) {
  if(source.width!==1024||source.height!==1024)throw new Error(`Full mascot master must be 1024x1024, got ${source.width}x${source.height}`);
  const output=new PNG({width:1024,height:1024});source.data.copy(output.data);return output;
}

export function fullAssetPath(mood) {
  return path.join(charactersDir, `jango-${mood}.png`);
}
