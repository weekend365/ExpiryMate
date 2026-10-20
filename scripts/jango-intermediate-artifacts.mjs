// Historical reconstruction before retirement only. After retirement, evidence
// distinguishes retained physical bytes from authorized missing artifacts.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {canonical,fileHash,local,readJson,readPng,sha} from './jango-design-gate.mjs';
import {resizePremultiplied} from '../apps/mobile/scripts/build-mascot-runtime-assets.mjs';
import {hasHistory,historicalEvidence,historicalHash} from './jango-history.mjs';

const {PNG}=createRequire(new URL('../apps/mobile/package.json',import.meta.url))('pngjs');
export const cleanupReceipt='design/jango/quality/cleanup/20261020.json';
const recipeVersion='jango-build-intermediates-v1';
const cache=new Map();
const canvas=(width,height=width)=>new PNG({width,height,colorType:6});
export function isPrunableIntermediate(file) {
  return /^design\/jango\/emoticons\/kakao-32\/v(?:20|21|22|23)\/(?:characters|thumbs)\/(?:0[1-9]|[12]\d|3[0-2])\.png$/.test(file)
    || /^design\/jango\/emoticons\/kakao-32\/v(?:20|21|22)\/preview-120\.png$/.test(file);
}
function composite(target,image,left=0,top=0) {
  assert(left>=0&&top>=0&&left+image.width<=target.width&&top+image.height<=target.height);
  for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){
    const s=(y*image.width+x)*4,d=((top+y)*target.width+left+x)*4;
    const a=image.data[s+3]/255,b=target.data[d+3]/255,alpha=a+b*(1-a);
    for(let c=0;c<3;c++)target.data[d+c]=alpha?Math.round((image.data[s+c]*a+target.data[d+c]*b*(1-a))/alpha):0;
    target.data[d+3]=Math.round(alpha*255);
  }
}
function recipeFor(file) {
  assert(isPrunableIntermediate(file),'Only the enumerated v20–v23 derived caches may be pruned');
  const base=file.split('/').slice(0,5).join('/'),manifestFile=base+'/manifest.json';
  const manifest=readJson(manifestFile),number=Number(file.match(/\/(\d{2})\.png$/)?.[1]);
  const type=file.endsWith('/preview-120.png')?'preview-120':file.split('/')[5];
  const records=type==='preview-120'?manifest:manifest.filter(row=>row.number===number);
  assert.equal(records.length,type==='preview-120'?32:1,'Manifest row required for cache reconstruction');
  const inputs={[manifestFile]:fileHash(manifestFile)};
  for(const row of records){
    const key=String(row.number).padStart(2,'0');
    if(type==='characters'){
      assert(row.source.startsWith(base+'/source-originals/'),'Physical original in the same version required');
      assert.equal(fileHash(row.source),row.sourceSHA256,'Original hash changed');
      inputs[row.source]=row.sourceSHA256;
    }else{
      const art=base+'/artwork/'+key+'.png',letters=base+'/lettering/'+key+'.png';
      inputs[art]=fileHash(art);inputs[letters]=fileHash(letters);
      assert.equal(inputs[letters],row.letteringSHA256,'Lettering hash changed');
    }
  }
  return {version:recipeVersion,type,manifest:manifestFile,numbers:records.map(row=>row.number),inputs};
}
function thumbnail(base,row) {
  const key=String(row.number).padStart(2,'0'),merged=canvas(1024);
  composite(merged,readPng(base+'/artwork/'+key+'.png'));
  composite(merged,readPng(base+'/lettering/'+key+'.png'));
  return resizePremultiplied(merged,120,120);
}
function reconstruct(recipe) {
  const base=recipe.manifest.slice(0,-'/manifest.json'.length);
  const rows=readJson(recipe.manifest).filter(row=>recipe.numbers.includes(row.number));
  let png;
  if(recipe.type==='characters'){
    const row=rows[0],source=readPng(row.source),[left,top,right,bottom]=row.sourceCrop;
    const tight=canvas(right-left,bottom-top);
    PNG.bitblt(source,tight,left,top,tight.width,tight.height,0,0);
    const scale=Math.min(944/tight.width,944/tight.height);
    const fitted=resizePremultiplied(tight,Math.max(1,Math.round(tight.width*scale)),Math.max(1,Math.round(tight.height*scale)));
    png=canvas(1024);composite(png,fitted,Math.floor((1024-fitted.width)/2),Math.floor((1024-fitted.height)/2));
  }else if(recipe.type==='thumbs'){
    png=thumbnail(base,rows[0]);
  }else{
    png=canvas(1024,512);
    for(let i=0;i<png.data.length;i+=4)png.data.set([245,246,240,255],i);
    for(const row of rows)composite(png,thumbnail(base,row),((row.number-1)%8)*128+4,Math.floor((row.number-1)/8)*128+4);
  }
  return PNG.sync.write(png,{colorType:6});
}
export function intermediateRecord(file) {
  const recipe=recipeFor(file),original=fs.readFileSync(local(file));
  const rebuilt=reconstruct(recipe);
  assert.equal(sha(rebuilt),sha(original),'Reconstructed PNG must match the existing bytes: '+file);
  return {file,sha256:sha(original),bytes:original.length,recipe};
}
export function reconstructedHash(entry) {
  assert(!hasHistory(),'Closed historical version: cached renders are retired; use historical evidence, not reconstruction');
  const recipe=recipeFor(entry.file);
  assert.deepEqual(entry.recipe,recipe,'Cache recipe or preserved inputs changed: '+entry.file);
  // Hash the inputs above on every call, even when a prior render is cached.
  const key=sha(canonical(recipe));
  if(!cache.has(key)){
    const bytes=reconstruct(recipe);
    cache.set(key,{sha256:sha(bytes),bytes:bytes.length});
  }
  const result=cache.get(key);
  assert.equal(result.sha256,entry.sha256,'Reconstructed historical hash mismatch: '+entry.file);
  assert.equal(result.bytes,entry.bytes,'Reconstructed historical size mismatch: '+entry.file);
  return result.sha256;
}
let receiptEntries;
export function historicalArtifactHash(file,expectedHash) {
  if(hasHistory()){
    const evidence=historicalEvidence(file,expectedHash);
    assert(evidence.measured,'Retired artifact has no current measured hash: '+file);
    return historicalHash(file,expectedHash);
  }
  if(fs.existsSync(local(file)))return fileHash(file);
  assert(isPrunableIntermediate(file),'Missing protected file: '+file);
  if(!receiptEntries){
    const receipt=readJson(cleanupReceipt);
    assert.equal(receipt.schemaVersion,1);
    receiptEntries=new Map(receipt.removed.map(entry=>[entry.file,entry]));
    assert.equal(receiptEntries.size,receipt.removed.length,'Duplicate cleanup entry');
  }
  const entry=receiptEntries.get(file);
  assert(entry,'Missing authorized cleanup record: '+file);
  assert.equal(entry.sha256,expectedHash,'Cleanup record differs from the original preservation snapshot');
  return reconstructedHash(entry);
}
