import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {generateKeyPairSync,sign} from 'node:crypto';
import {policy,root,local,quality,readJson,readPng,fileHash,writeJson,prepare,audit,check,promote,assertReview,canonical,screenMouthMode,technical,styleTechnical,validateReferences,validateComposition,attachmentPlan,parsePrepareArgs,validateInputLineage} from './jango-design-gate.mjs';
import {readMasterSet} from './jango-master-set.mjs';
const require=createRequire(path.join(root,'apps/mobile/package.json')),{PNG}=require('pngjs');
const rules=policy(),set=readMasterSet();
const entry=n=>set.entries.find(e=>e.number===n);
const expression={family:'인사',intensity:2,eyes:'타원',brows:'없음',pose:'손인사'};
function fixture(id,number=9){
 const source=entry(number),directory=`design/jango/emoticons/kakao-32/${id}`;
 const prepared=prepare(id,source.source,'표정 유지',source.mouthMode,'모드 유지',expression);
 fs.mkdirSync(local(directory),{recursive:true});
 fs.copyFileSync(local(source.source),local(directory+'/source.png'));fs.copyFileSync(local(source.sticker),local(directory+'/sticker.png'));
 const candidate={id,kind:'emoticon',styleProfile:'handdrawn-crayon',directory,source:directory+'/source.png',sticker:directory+'/sticker.png',mouthMode:source.mouthMode,mouthRoi:source.inspection.mouthRoi,tiltDegrees:source.inspection.tiltDegrees,visibility:'clear',expression,preflight:`${quality}/jobs/${id}/preflight.json`,disposition:'candidate'};
 writeJson(`${quality}/candidates/${id}.json`,candidate);return{candidate,prepared};
}
function clean(id){for(const dir of [`design/jango/emoticons/kakao-32/${id}`,`${quality}/jobs/${id}`])fs.rmSync(local(dir),{recursive:true,force:true});for(const dir of ['candidates','reports'])fs.rmSync(local(`${quality}/${dir}/${id}.json`),{force:true});}

test('v18 selected bytes and representative are immutable; mouth thresholds unchanged',()=>{
 assert.equal(set.entries.length,32);assert.equal(set.representative,24);
 const old=readJson(`${quality}/history/v18-creation/design/jango/quality/rules.json`);
 for(const key of ['mouthScreen','openMouthScreen','lineMouthScreen','mouthModes'])assert.deepEqual(rules[key],old[key]);
 assert.deepEqual(set.entries.filter(e=>e.historicalMouthStatus==='needs-review').map(e=>e.number),[5,12,15,20,21,28,29,31,32]);
});
test('four actual v18 mouth anchors pass without recalibrating limits',()=>{for(const n of [9,1,11,17]){const e=entry(n);assert.equal(screenMouthMode(readPng(e.source),e.inspection.mouthRoi,rules,e.mouthMode).status,'pass',String(n));}});
test('master adoption is explicit and is not a signed release or recreated preparation',()=>{
 const report=audit('v18-24');assert.equal(report.preparation,'master-adoption');assert.equal(report.designStatus,'user-selected-master; signed release pending');
 assert.throws(()=>assertReview(report,{approved:true},''),/not configured/);
 assert.equal(audit('v18-29').mouth.status,'needs-review');
 assert.throws(()=>audit('v18-33'),/Unknown MASTER/);
});
test('old style, unregistered input, missing references and hash changes are refused',()=>{
 assert.throws(()=>prepare('invalid-style',rules.master.file,'test','idle-u','',null,{styleProfile:'legacy-clean'}),/Unknown style/);
 assert.throws(()=>prepare('invalid-input','design/jango/reference/v18-composition.png','test'),/registered derivative/);
 const bad=structuredClone(rules);bad.master.sha256='0'.repeat(64);assert.throws(()=>validateReferences(bad),/hash/);
 bad.master=rules.master;bad.mouthReferences['idle-u'].file='design/jango/missing.png';assert.throws(()=>validateReferences(bad),/reference mismatch/);
 assert.throws(()=>local('../outside.png'),/Canonical/);
});
test('prepare keeps positional CLI, validates options and computes deduplicated actual indices',()=>{
 assert.deepEqual(parsePrepareArgs(['x',entry(1).source,'인사','speak-open','인사','--style=handdrawn-crayon','--kind','emoticon']).options,{styleProfile:'handdrawn-crayon',kind:'emoticon'});
 assert.throws(()=>parsePrepareArgs(['--unknown','x']),/Unknown/);
 const composition={file:rules.compositionReferences.v18.file,panel:13};
 const attached=attachmentPlan(rules,'attachment-test',entry(13).source,'speak-open','handdrawn-crayon',composition);
 assert.equal(attached.references.length,4);assert.equal(attached.referenceRoles[0].imageIndex,attached.referenceRoles[1].imageIndex);
 for(const role of attached.referenceRoles)assert.equal(attached.references[role.imageIndex-1],role.file);
 for(const panel of [0,33,1.5])assert.throws(()=>validateComposition(rules,{...composition,panel}),/panel/);
 assert.throws(()=>validateComposition(rules,{file:entry(1).source,panel:1}),/Unregistered/);
 const over=structuredClone(rules);over.styleProfiles['handdrawn-crayon'].styleMaster.file=entry(3).source;over.master.file=entry(4).source;
 const max=attachmentPlan(over,'max',entry(5).source,'speak-open','handdrawn-crayon',composition);assert.equal(max.references.length,5);
});
test('new preparation rejects missing reasons or malformed intent and never overwrites a job',()=>{
 const id=`prepare-test-${process.pid}`;
 try{
 assert.throws(()=>prepare(id,entry(11).source,'집중','neutral-line'),/reason/);
 assert.throws(()=>prepare(id,entry(11).source,'집중','neutral-line','집중',{...expression,intensity:4}),/intensity/);
 assert.throws(()=>prepare(id,entry(11).source,'집중','neutral-line','집중',null,{panel:11}),/together/);
 const p=prepare(id,entry(11).source,'집중','neutral-line','집중',expression);assert.equal(p.policyVersion,5);assert(p.references.includes(entry(11).source));assert(!p.references.includes(`${quality}/jobs/${id}/master-mouth.png`));
 assert.throws(()=>prepare(id,entry(11).source,'집중'),/already exists/);
 }finally{clean(id);}
});
test('fresh candidate, valid test signature, forgery, stale prompt and uncertain pose remain enforced',()=>{
 const id=`gate-test-${process.pid}`,releases=fs.readFileSync(local(`${quality}/releases.json`));
 try{
 const {candidate,prepared}=fixture(id);const report=audit(id);writeJson(`${quality}/reports/${id}.json`,report);
 assert.equal(report.preparation,'pass');assert.equal(report.mouth.status,'pass');assert.equal(report.designStatus,'needs-review');
 const keys=generateKeyPairSync('ed25519'),publicKey=keys.publicKey.export({type:'spki',format:'pem'});
 const payload={binding:report.binding,decision:'approved',reviewer:'ephemeral-unit-test',reviewedAt:'2026-10-01',checks:Object.fromEntries([...rules.visualChecks,...rules.styleProfiles['handdrawn-crayon'].visualChecks].map(k=>[k,true]))};
 const review={payload,signature:sign(null,Buffer.from(canonical(payload)),keys.privateKey).toString('base64')};
 assert.doesNotThrow(()=>assertReview(report,review,publicKey));
 assert.throws(()=>assertReview(report,review,''),/not configured/);
 assert.throws(()=>assertReview(report,{...review,payload:{...payload,reviewer:'forged'}},publicKey),/signature/);
 assert.throws(()=>assertReview(report,{...review,payload:{...payload,checks:{}}},publicKey),/Visual check/);
 promote(id,review,publicKey);assert(check(publicKey).entries.some(e=>e.id===id));
 for(const changed of [{...report,preparation:'stale'},{...report,mouth:{status:'needs-review'}},{...report,technical:{status:'fail'}}])assert.throws(()=>assertReview(changed,review,publicKey));
 fs.appendFileSync(local(prepared.prompt),' changed');const stale=audit(id);assert.equal(stale.preparation,'stale');assert.notEqual(stale.binding,report.binding);
 writeJson(`${quality}/candidates/${id}.json`,{...candidate,tiltDegrees:40});assert.equal(audit(id).mouth.status,'needs-review');
 writeJson(`${quality}/candidates/${id}.json`,{...candidate,disposition:'approved'});assert.throws(()=>audit(id),/self-approve/);
 }finally{fs.writeFileSync(local(`${quality}/releases.json`),releases);clean(id);}
});
test('registered derivative must have intact generation, input and attachment provenance',()=>{
 const id=`lineage-test-${process.pid}`;
 try{
 const {candidate,prepared}=fixture(id);assert.throws(()=>validateInputLineage(candidate.source),/registered derivative/);
 candidate.generationRecord=candidate.directory+'/generation.json';
 const generation={source:candidate.source,sourceSHA256:fileHash(candidate.source),preflight:candidate.preflight,preflightSHA256:fileHash(candidate.preflight),promptSHA256:prepared.promptSHA256,actualReferences:prepared.references.map(file=>({file,sha256:prepared.referenceHashes[file]}))};
 writeJson(candidate.generationRecord,generation);writeJson(`${quality}/candidates/${id}.json`,candidate);assert.doesNotThrow(()=>validateInputLineage(candidate.source));
 writeJson(candidate.generationRecord,{...generation,sourceSHA256:'tampered'});assert.throws(()=>validateInputLineage(candidate.source),/changed/);
 }finally{clean(id);}
});
test('incomplete ROI, empty PNG, insufficient margin and clipped original never pass',()=>{
 const e=entry(9),png=readPng(e.source);assert.throws(()=>screenMouthMode(png,[-1,0,10,10],rules,'idle-u'),/ROI/);
 assert.equal(technical(new PNG({width:360,height:360})).status,'fail');
 const sticker=readPng(e.sticker);sticker.data[(3*360+180)*4+3]=255;assert.equal(styleTechnical(sticker,png).status,'fail');
 const clipped=readPng(e.source);clipped.data[(30*clipped.width)*4+3]=255;assert.equal(styleTechnical(readPng(e.sticker),clipped).status,'fail');
});
test('unregistered image is rejected',()=>{const file='design/jango/emoticons/unregistered-test.png';try{fs.copyFileSync(local(entry(9).source),local(file));assert.throws(()=>check(),/Unregistered/);}finally{fs.rmSync(local(file),{force:true});}});
test("line modes distinguish flat, sad, smiling, filled and cropped geometry", () => {
  // Synthetic regression fixtures only; never used as art or generation references.
  const fixture=(kind)=>{
    const p=new PNG({width:120,height:80});p.data.fill(255);
    for(let y=0;y<80;y++) for(let x=0;x<120;x++) {
      if(x<25||x>95) continue;
      const u=(x-60)/35;
      const center=kind==='sad'?32+15*u*u:kind==='smile'?47-15*u*u:40;
      const ink=kind==='filled'?Math.abs(y-40)<=16:kind==='closed'?(Math.abs(y-28)<3||Math.abs(y-52)<3||((x<29||x>91)&&y>=28&&y<=52)):Math.abs(y-center)<=3;
      if(ink) p.data.set([35,35,35,255],(y*120+x)*4);
    }
    return p;
  };
  const roi=[10,10,100,60];
  assert.equal(screenMouthMode(fixture('flat'),roi,rules,'neutral-line').status,'pass');
  assert.equal(screenMouthMode(fixture('sad'),roi,rules,'sad-arc').status,'pass');
  for(const [shape,mode] of [['flat','neutral-line'],['sad','sad-arc']]) {
    const broken=fixture(shape);
    for(let y=0;y<80;y++) for(let x=59;x<=62;x++) broken.data.set([255,255,255,255],(y*120+x)*4);
    assert.notEqual(screenMouthMode(broken,roi,rules,mode).status,'pass','Textured disconnected stroke must not pass');
  }
  for(const kind of ['smile','filled','closed']) for(const mode of ['neutral-line','sad-arc']) assert.notEqual(screenMouthMode(fixture(kind),roi,rules,mode).status,'pass',`${kind}/${mode}`);
  assert.notEqual(screenMouthMode(fixture('sad'),roi,rules,'neutral-line').status,'pass');
  assert.notEqual(screenMouthMode(fixture('flat'),roi,rules,'sad-arc').status,'pass');
  assert.equal(screenMouthMode(fixture('flat'),[40,30,25,25],rules,'neutral-line').status,'needs-review');
});
test('open mouth rejects missing tongue and teeth without inheriting old images',()=>{
 const e=entry(1),[x,y,w,h]=e.inspection.mouthRoi;
 const noTongue=readPng(e.source),teeth=readPng(e.source);
 for(let row=y;row<y+h;row++)for(let col=x;col<x+w;col++){const i=(row*noTongue.width+col)*4,[r,g,b]=noTongue.data.subarray(i,i+3);if(r>150&&g>60&&r>g*1.2&&r>b*1.1&&Math.abs(g-b)<65)noTongue.data.set([27,27,25,255],i);}
 for(let row=y+Math.floor(h*.35);row<y+Math.floor(h*.55);row++)for(let col=x+Math.floor(w*.35);col<x+Math.floor(w*.65);col++)teeth.data.set([255,255,255,255],(row*teeth.width+col)*4);
 for(const p of [noTongue,teeth])assert.notEqual(screenMouthMode(p,e.inspection.mouthRoi,rules,'speak-open').status,'pass');
});
