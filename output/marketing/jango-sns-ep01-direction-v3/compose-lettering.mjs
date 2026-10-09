// Deterministic typography composition only; never draws or replaces scene artwork.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {resizePremultiplied} from '../../../apps/mobile/scripts/build-mascot-runtime-assets.mjs';
const base=path.dirname(fileURLToPath(import.meta.url));
const require=createRequire(path.resolve(base,'../../../apps/mobile/package.json'));
const {PNG}=require('pngjs');
const art=PNG.sync.read(fs.readFileSync(path.join(base,'discovery-art-r1.png')));
const letters=PNG.sync.read(fs.readFileSync(path.join(base,'discovery-lettering-r1.png')));
assert.equal(art.width,letters.width);assert.equal(art.height,letters.height);
for(let i=0;i<art.data.length;i+=4){
  const a=letters.data[i+3]/255;
  for(let c=0;c<3;c++)art.data[i+c]=Math.round(letters.data[i+c]*a+art.data[i+c]*(1-a));
  art.data[i+3]=255;
}
fs.writeFileSync(path.join(base,'discovery-review-r1.png'),PNG.sync.write(art));
fs.writeFileSync(path.join(base,'discovery-review-mobile-r1.png'),PNG.sync.write(resizePremultiplied(art,360,Math.round(art.height*360/art.width))));
