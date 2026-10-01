// Register measured review candidates and preserved attempts. Never signs or promotes.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
import {createRequire} from 'node:module';
import {root,local,readJson,readPng,writeJson,fileHash,screenMouthMode,policy,styleTechnical,contextBinding} from './jango-design-gate.mjs';
import {resizePremultiplied} from '../apps/mobile/scripts/build-mascot-runtime-assets.mjs';
const require=createRequire(path.join(root,'apps/mobile/package.json'));
const {PNG}=require('pngjs');
const base=process.argv.find(a=>a.startsWith('--base='))?.slice(7);
assert(base&&/^design\/jango\/emoticons\/kakao-32\/v\d+$/.test(base),'Explicit version required');
assert(base!=='design/jango/emoticons/kakao-32/v18','v18 is a MASTER set, not an active generation batch');
const selected=readJson(base+'/selection.json'),inspection=readJson(base+'/inspection.json');
const attempts=fs.existsSync(local(base+'/iteration-inspection.json'))?readJson(base+'/iteration-inspection.json'):{};
const partial=process.argv.includes('--partial'),entries=[];
for(const filename of fs.readdirSync(local(base+'/generation-records')).filter(f=>f.endsWith('.json')).sort()){
 const generation=readJson(base+'/generation-records/'+filename),id=generation.id;
 const number=Number(id.slice(0,2)),key=String(number).padStart(2,'0'),isSelected=selected[key]?.jobId===id;
 const observed=isSelected?inspection[key]:attempts[id];
 if(!observed&&partial)continue;
 assert(observed,'Missing observed coordinates for '+id);
 assert.equal(fileHash(generation.source),generation.sourceSHA256,'Generated source changed');
 if(isSelected)assert.equal(observed.sourceSHA256,generation.sourceSHA256,'Inspection must refer to the selected original');
 assert.equal(fileHash(generation.preflight),generation.preflightSHA256,'Prepared record changed');
 assert.equal(fileHash(generation.prompt),generation.promptSHA256,'Actual prompt changed');
 const prepared=readJson(generation.preflight);
 assert.deepEqual(generation.referenceRoles,prepared.referenceRoles);
 assert.deepEqual(generation.actualReferences,prepared.references.map(file=>({file,sha256:prepared.referenceHashes[file]})));
 for(const ref of generation.actualReferences)assert.equal(fileHash(ref.file),ref.sha256,'Actual attached file changed');
 assert.equal(prepared.composition.panel,number);
 const source=readPng(generation.source);
 let stickerFile;
 if(isSelected){assert.equal(generation.source,base+'/'+selected[key].source);stickerFile=base+'/stickers/'+key+'.png';}
 else{
  // Historical attempt preview uses the complete original canvas; no artwork edits.
  const factor=Math.min(336/source.width,336/source.height),scaled=resizePremultiplied(source,Math.round(source.width*factor),Math.round(source.height*factor)),preview=new PNG({width:360,height:360});
  PNG.bitblt(scaled,preview,0,0,scaled.width,scaled.height,Math.floor((360-scaled.width)/2),Math.floor((360-scaled.height)/2));
  stickerFile=base+'/iterations/'+id+'.png';fs.mkdirSync(path.dirname(local(stickerFile)),{recursive:true});fs.writeFileSync(local(stickerFile),PNG.sync.write(preview));
 }
 const candidate={id,kind:'emoticon',styleProfile:prepared.styleProfile,directory:base,source:generation.source,sticker:stickerFile,mouthMode:prepared.mouthMode,mouthRoi:observed.mouthRoi,tiltDegrees:observed.tiltDegrees,visibility:observed.visibility,expression:prepared.expression,composition:prepared.composition,preflight:generation.preflight,generationRecord:base+'/generation-records/'+filename,disposition:isSelected?'candidate':'rejected',selection:isSelected?'review-set':'iteration-history'};
 writeJson('design/jango/quality/candidates/'+id+'.json',candidate);
 const mouth=screenMouthMode(source,observed.mouthRoi,policy(),prepared.mouthMode);
 if(observed.visibility!=='clear'||Math.abs(observed.tiltDegrees)>policy().mouthScreen.maxTiltDegrees)mouth.status='needs-review';
 entries.push({id,number,selected:isSelected,preparation:isDeepStrictEqual(prepared.context,contextBinding(policy(),prepared.styleProfile))?'pass':'stale',mouthStatus:mouth.status,mouthSamples:mouth.samples,technical:styleTechnical(readPng(stickerFile),source),observation:observed.observation});
}
if(!partial)assert.equal(entries.filter(e=>e.selected).length,32);
writeJson(base+'/inspection-status.json',{approval:'candidate; external signature required',entries});
console.log(JSON.stringify(entries.map(e=>({id:e.id,mouth:e.mouthStatus,technical:e.technical.status,selected:e.selected})),null,2));
