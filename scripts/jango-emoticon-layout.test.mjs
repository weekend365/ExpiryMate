import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {validatePlan,titleFor,validateLayout,cropFor,placement} from './jango-emoticon-layout.mjs';
import {local,readJson,readPng,fileHash,technical,visibleBounds} from './jango-design-gate.mjs';
import {readMasterSet} from './jango-master-set.mjs';
import {normalizeLettering,renderLettering} from './render-jango-lettering.mjs';
import {cleanupReceipt,historicalArtifactHash,isPrunableIntermediate,reconstructedHash} from './jango-intermediate-artifacts.mjs';
import {historicalHash,historicalEvidence,readHistoricalJson} from './jango-history.mjs';
import {finalBase,verifyFinalSet,verifyFinalBaselineEvidence} from './build-jango-final-set.mjs';
const {PNG}=createRequire(new URL('../apps/mobile/package.json',import.meta.url))('pngjs');
const base='design/jango/emoticons/kakao-32/v18',plan=readJson(base+'/plan.json'),set=readMasterSet();
const example=()=>structuredClone(plan[0]);
test('MASTER roster retains exact 32 titles, lines, mouth modes and original 96 protected assets',()=>{
 validatePlan(plan);const original=readJson('design/jango/quality/history/v18-creation/'+base+'/manifest.json');
 for(const p of plan){const m=set.entries.find(e=>e.number===p.n),old=original.find(e=>e.number===p.n);assert.equal(p.line,m.line);assert.equal(p.title,m.title);assert.equal(p.mouthMode,m.mouthMode);assert.equal(fileHash(m.source),old.sourceSHA256);assert.equal(fileHash(m.sticker),old.sha256);assert.equal(fileHash(m.lettering),old.letteringSHA256);assert.equal(p.composition.panel,p.n);}
});
test('silent titles and missing/duplicate roster entries are rejected correctly',()=>{
 assert.equal(titleFor({n:3,title:'잘 자',line:''}),'잘 자');assert.equal(titleFor({n:3,line:''}),'장고 03');
 const p=structuredClone(plan);p[1].title=p[0].title;assert.throws(()=>validatePlan(p),/Unique semantic/);p[1].title='다른 제목';p[1].n=1;assert.throws(()=>validatePlan(p),/Unique numbers/);
});
test('invalid framing, omitted framing intent and excluded character cannot be hidden',()=>{
 for(const rect of [[0,0,1255,100],[-1,0,100,100],[0,0,0,100],[0,0,10.5,100]]){const p=example();Object.assign(p.layout,{framingCrop:rect,framingNote:'intent'});assert.throws(()=>validateLayout(p,{width:1254,height:1254}));}
 const p=example();p.layout.framingCrop=[0,0,1000,1000];delete p.layout.framingNote;assert.throws(()=>validateLayout(p,{width:1254,height:1254}),/intent/);assert.throws(()=>cropFor([400,400,900,900],{width:1254,height:1254},{framingCrop:[0,0,100,100]}),/excludes/);
 assert.deepEqual(placement(800,1000,[40,40,944,944]),{width:755,height:944,x:134,y:40});
});
test('caption kind, typography, rotation and exact multiline order are enforced',()=>{
 for(const change of [p=>p.captionKind='silent',p=>p.captionKind='unknown',p=>p.layout.lettering.rotation=11,p=>p.layout.lettering.font='Missing',p=>p.layout.lettering.x=1024]){const p=example();change(p);assert.throws(()=>validateLayout(p,{width:1254,height:1254}));}
 const p=example();p.line='항상 고마워!';p.layout.lettering.lines=['항상','고마워!'];p.layout.symbols=[{text:'zzz',x:800,y:300,size:100,rotation:5}];assert(validateLayout(p,{width:1254,height:1254}));
 for(const change of [r=>r.layout.lettering.lines=['고마워!','항상'],r=>r.layout.lettering.lines=['항상','고마워'],r=>r.layout.symbols[0].rotation=11,r=>r.layout.symbols[0].x=-1,r=>r.layout.symbols[0].text='임의 문구']){const bad=structuredClone(p);change(bad);assert.throws(()=>validateLayout(bad,{width:1254,height:1254}));}
});
test('full-body framing rejects anatomy crops and preserves all source bounds',()=>{
 const p=example();p.layout.framing='full-body';
 assert.throws(()=>validateLayout(p,{width:1254,height:1254}),/must not crop/);
 assert.throws(()=>cropFor([178,46,1035,1224],{width:1254,height:1254},p.layout),/must not crop/);
 delete p.layout.framingCrop;delete p.layout.framingNote;
 assert(validateLayout(p,{width:1254,height:1254}));
 assert.deepEqual(cropFor([178,46,1035,1224],{width:1254,height:1254},p.layout),[174,42,865,1186]);
 Object.assign(p.layout.lettering,{font:'Gaegu-Bold',rotation:0,inkHeight:108,outlinePx:9,punctuationScale:.55,maxWidth:888});
 assert(validateLayout(p,{width:1254,height:1254}));
 for(const change of [{inkHeight:0},{outlinePx:17},{punctuationScale:0},{rotation:11},{lines:['안녕!']}]){const bad=structuredClone(p);Object.assign(bad.layout.lettering,change);assert.throws(()=>validateLayout(bad,{width:1254,height:1254}));}
});
test('measured lettering retains dark ink, a visible white outline and transparent padding',()=>{
 const ink=new PNG({width:24,height:16});for(let y=5;y<=10;y++)for(let x=4;x<=19;x++)ink.data.set([33,33,33,255],(y*ink.width+x)*4);
 const spec={inkHeight:60,outlinePx:3,maxWidth:200,x:512,y:110,punctuationScale:.55};
 const out=normalizeLettering(ink,spec),[x,y,w,h]=out.metrics.bounds;
 assert.equal(out.metrics.inkHeight,60);assert.equal(h,66);assert(w<=200);
 assert.deepEqual([...out.png.data.subarray((110*1024+512)*4,(110*1024+512)*4+4)],[33,33,33,255]);
 assert.equal(out.png.data[(110*1024+x+1)*4],255);assert(out.png.data[(110*1024+x+1)*4+3]>128);
 assert.equal(out.png.data[3],0);assert(y>=0&&x>=0);
 assert.throws(()=>normalizeLettering(ink,{...spec,y:1}),/outside canvas/);
 assert.throws(()=>normalizeLettering(new PNG({width:10,height:10}),spec),/contain ink/);
});
test('normalized text rotation preserves ink, white outline and safe transparent bounds',()=>{
 const ink=new PNG({width:48,height:24});for(let y=7;y<17;y++)for(let x=5;x<43;x++)ink.data.set([33,33,33,255],(y*48+x)*4);
 const spec={inkHeight:100,outlinePx:7,maxWidth:500,x:512,y:200,punctuationScale:.55};
 const baseline=normalizeLettering(ink,spec);
 for(const rotation of [-7,7]){
  const result=normalizeLettering(ink,{...spec,rotation});assert.equal(result.metrics.rotation,rotation);
  assert(result.metrics.bounds[3]>baseline.metrics.bounds[3]);assert.equal(result.png.data[3],0);
  let dark=0,white=0;for(let i=0;i<result.png.data.length;i+=4){if(result.png.data[i+3]>200){if(result.png.data[i]<60)dark++;if(result.png.data[i]>240)white++;}}
  assert(dark>1000&&white>100);assert.throws(()=>normalizeLettering(ink,{...spec,rotation,y:1}),/outside canvas/);
 }
 assert.throws(()=>normalizeLettering(ink,{...spec,rotation:11}),/rotation/);
});
test('shared font reference retains natural glyph heights instead of enlarging short syllables',()=>{
 const rectangle=(width,height)=>{const p=new PNG({width:width+8,height:height+8});for(let y=4;y<height+4;y++)for(let x=4;x<width+4;x++)p.data.set([33,33,33,255],(y*p.width+x)*4);return p;};
 const reference=rectangle(80,40),short=rectangle(40,20),tall=rectangle(40,40);
 const spec={size:160,sizeBasis:'font-reference',referenceText:'장고야 부탁해',inkHeight:80,outlinePx:4,maxWidth:300,x:512,y:120,punctuationScale:.55};
 const a=normalizeLettering(short,spec,reference),b=normalizeLettering(tall,spec,reference);
 assert.equal(a.metrics.inkHeight,40);assert.equal(b.metrics.inkHeight,80);
 assert.equal(a.metrics.scale,b.metrics.scale);assert.equal(a.metrics.effectiveFontSize1024,b.metrics.effectiveFontSize1024);
 assert.equal(a.metrics.bounds[2],b.metrics.bounds[2]);
 assert.throws(()=>normalizeLettering(short,spec),/Reference lettering/);
 assert.throws(()=>normalizeLettering(rectangle(160,20),spec,reference),/never stretch or auto-fit/);
 const legacy=normalizeLettering(short,{...spec,sizeBasis:undefined});assert.equal(legacy.metrics.inkHeight,80);
 const row=example();delete row.layout.framingCrop;delete row.layout.framingNote;
 Object.assign(row.layout.lettering,{...spec,font:'GamjaFlower-Regular',rotation:0,outline:0});
 assert(validateLayout(row,{width:1254,height:1254}));
 for(const change of [{sizeBasis:'per-caption'},{referenceText:''},{referenceText:'문구\n변경'},{inkHeight:undefined},{inkStrokePercent:4},{inkStrokePercent:-1}]){const bad=structuredClone(row);Object.assign(bad.layout.lettering,change);assert.throws(()=>validateLayout(bad,{width:1254,height:1254}));}
});
test('32 PNGs retain transparent edges, safe margins and exact caption-free layout without collisions',()=>{
 for(const p of plan){const k=String(p.n).padStart(2,'0'),sticker=readPng(base+'/stickers/'+k+'.png'),letters=readPng(base+'/lettering/'+k+'.png'),art=readPng(base+'/artwork/'+k+'.png');assert.equal(technical(sticker).status,'pass');assert(visibleBounds(sticker).margin>=8);let overlap=0;for(let i=3;i<art.data.length;i+=4)if(art.data[i]>100&&letters.data[i]>100)overlap++;assert.equal(overlap,0,k);}
});
test('Gaegu font and license match preserved source provenance',()=>{const p=readJson(base+'/fonts/provenance.json');for(const[f,hash]of Object.entries(p.files))assert.equal(fileHash(base+'/fonts/'+f),hash);});
test('MASTER builder verifies without overwriting and no previous version input is needed',()=>{execFileSync(process.execPath,['scripts/build-jango-emoticons.mjs'],{stdio:'pipe'});assert.equal(readMasterSet().entries.length,32);});
test('macOS lettering reproduces frozen v18 output in a separate version and refuses MASTER writes',{skip:process.platform!=='darwin'},()=>{
 const temp='design/jango/emoticons/kakao-32/v'+Date.now();fs.mkdirSync(local(temp));
 try{fs.copyFileSync(local(base+'/plan.json'),local(temp+'/plan.json'));fs.mkdirSync(local(temp+'/fonts'));for(const name of ['Gaegu-Regular.ttf','Gaegu-Bold.ttf'])fs.linkSync(local(base+'/fonts/'+name),local(temp+'/fonts/'+name));execFileSync('osascript',['-l','JavaScript','scripts/render-jango-lettering.jxa.js',temp],{stdio:'pipe'});for(const entry of set.entries)assert.equal(fileHash(temp+'/lettering/'+String(entry.number).padStart(2,'0')+'.png'),entry.letteringSHA256);assert.throws(()=>execFileSync('osascript',['-l','JavaScript','scripts/render-jango-lettering.jxa.js',base],{stdio:'pipe'}),/immutable/);}finally{fs.rmSync(local(temp),{recursive:true,force:true});}
});
test('single-cut lettering preserves unselected layers and the exact three-period caption',{skip:process.platform!=='darwin'},()=>{
 const temp='design/jango/emoticons/kakao-32/v'+Date.now(),reference='design/jango/emoticons/kakao-32/v24';fs.mkdirSync(local(temp));
 try{
  const rows=readJson(reference+'/plan.json');rows.find(r=>r.n===29).line='지쳤어...';rows.find(r=>r.n===29).title='지쳤어...';
  fs.writeFileSync(local(temp+'/plan.json'),JSON.stringify(rows));fs.mkdirSync(local(temp+'/fonts'));fs.mkdirSync(local(temp+'/lettering'));
  for(const name of ['Gaegu-Regular.ttf','Gaegu-Bold.ttf','GamjaFlower-Regular.ttf'])fs.linkSync(local(reference+'/fonts/'+name),local(temp+'/fonts/'+name));
  fs.copyFileSync(local(reference+'/lettering/01.png'),local(temp+'/lettering/01.png'));const unchanged=fileHash(temp+'/lettering/01.png');
  const records=renderLettering(temp,[29]);assert.equal(records.length,1);assert.equal(records[0].number,29);assert.equal(records[0].line,'지쳤어...');assert.equal(records[0].normalization.complete,true);
  assert.equal(fileHash(temp+'/lettering/01.png'),unchanged);assert.deepEqual(fs.readdirSync(local(temp+'/lettering')).sort(),['01.png','29.png']);
  for(const only of [[],[0],[33],[29,29]])assert.throws(()=>renderLettering(temp,only),/Valid unique lettering numbers/);
 }finally{fs.rmSync(local(temp),{recursive:true,force:true});}
});
test('closed v20–v23 keep original captions, intent, layout and generation/reuse records',()=>{
 const prefix='design/jango/emoticons/kakao-32/';
 const versions=[20,21,22,23].map(n=>prefix+'v'+n);
 const records=versions.map(version=>({version,rows:readHistoricalJson(version+'/plan.json'),manifest:readHistoricalJson(version+'/manifest.json'),selection:readHistoricalJson(version+'/selection.json')}));
 for(const {version,rows,manifest,selection}of records){
  validatePlan(rows);assert.equal(manifest.length,version.endsWith('v23')?1:32);
  assert(!fs.existsSync(local(version)));
  for(const m of manifest){
   assert.equal(m.fullBodyPreserved,true);assert.equal(m.sourceClipped,false);assert.equal(m.captionArtOverlapPixels,0);
   const key=String(m.number).padStart(2,'0'),choice=selection[key],source=version+'/'+choice.source;
   assert.equal(historicalHash(source,m.sourceSHA256),m.sourceSHA256);
   const evidence=historicalEvidence(version+'/'+m.file,m.sha256);
   assert(['deduplicated','retired'].includes(evidence.status));
   assert.equal(evidence.measured,evidence.status==='deduplicated');
  }
 }
 assert.equal(records[0].rows.filter(r=>r.operation==='layout-lettering-only').length,30);
 assert.deepEqual(records[1].rows.filter(r=>r.operation==='individual image edit').map(r=>r.n),[3,8,11,12,16,18,21,31]);
 assert.equal(records[2].rows.filter(r=>r.operation==='layout-lettering-only').length,32);
 assert.equal(records[0].rows[10].line,'음…');assert.equal(records[1].rows[10].line,'멍…');
 assert.equal(records[2].rows[28].line,'절전 중…');assert.equal(records[3].rows[28].line,'지쳤어...');
 const generation=readHistoricalJson(versions[3]+'/generation-records/29-v23-r1.json');
 assert.equal(generation.tool,'built-in image_gen');assert.equal(historicalHash(generation.source,generation.sourceSHA256),generation.sourceSHA256);
});
test('final 32 preserve full bodies, shared typography, transparent margins and collision-free caption layers',()=>{
 const rows=readJson(finalBase+'/plan.json'),manifest=readJson(finalBase+'/manifest.json'),letters=readJson(finalBase+'/lettering-record.json'),tiers=new Map();
 validatePlan(rows);
 for(const row of rows){
  const key=String(row.n).padStart(2,'0'),m=manifest.find(x=>x.number===row.n),l=letters.find(x=>x.number===row.n),s=row.layout.lettering;
  assert.equal(s.sizeBasis,'font-reference');assert.equal(s.font,'GamjaFlower-Regular');
  assert.equal(l.normalization.method,'shared-reference-font-size-with-pixel-outline');
  assert.equal(fileHash(finalBase+'/lettering/'+key+'.png'),l.sha256);
  assert.equal(fileHash(l.calibration.file),l.calibration.sha256);
  assert.equal(l.normalization.effectiveFontSize1024,s.size*l.normalization.scale);
  if(tiers.has(s.inkHeight))assert.equal(l.normalization.effectiveFontSize1024,tiers.get(s.inkHeight));else tiers.set(s.inkHeight,l.normalization.effectiveFontSize1024);
  const sticker=readPng(finalBase+'/stickers/'+key+'.png');
  assert.equal(technical(sticker).status,'pass');assert(visibleBounds(sticker).margin>=8);assert(m.bytes<=150000);
  assert.equal(fileHash(finalBase+'/stickers/'+key+'.png'),m.sha256);
  assert.equal(m.fullBodyPreserved,true);assert.equal(m.sourceClipped,false);assert.equal(m.captionArtOverlapPixels,0);
  const art=readPng(finalBase+'/artwork/'+key+'.png'),text=readPng(finalBase+'/lettering/'+key+'.png');
  for(let i=3;i<art.data.length;i+=4)assert(!(art.data[i]>100&&text.data[i]>100),'Text/art collision '+key);
 }
 assert.equal(tiers.size,3);assert.equal(rows[28].line,'지쳤어...');
 const currentStatus=readJson(finalBase+'/inspection-status.json'),originalStatus=readHistoricalJson(finalBase+'/inspection-status.json');
 for(const row of currentStatus.entries){assert.equal(row.preparation,'stale');row.preparation=originalStatus.entries.find(old=>old.id===row.id).preparation;}
 delete currentStatus.historyNote;assert.deepEqual(currentStatus,originalStatus,'Inspection values and uncertainty must remain unchanged');
 const fonts=readJson(finalBase+'/fonts/provenance.json');for(const [name,hash]of Object.entries(fonts.files))assert.equal(fileHash(finalBase+'/fonts/'+name),hash);
});
test('previous 197-cache receipt is immutable evidence and cannot claim current reconstruction after retirement',()=>{
 const receipt=readJson(cleanupReceipt);assert.equal(receipt.removed.length,197);
 for(const entry of receipt.removed){
  assert(isPrunableIntermediate(entry.file));assert(!fs.existsSync(local(entry.file)));
  const evidence=historicalEvidence(entry.file,entry.sha256);
  assert.equal(evidence.status,'previously-pruned');assert.equal(evidence.measured,false);
 }
 const entry=receipt.removed[0];
 assert.throws(()=>reconstructedHash(entry),/Closed historical/);
 assert.throws(()=>historicalArtifactHash(entry.file,entry.sha256),/no current measured hash/);
 assert.throws(()=>historicalEvidence(entry.file,'0'.repeat(64)),/snapshot hash mismatch/);
 assert.throws(()=>historicalArtifactHash('design/jango/emoticons/kakao-32/v23/source-originals/missing.png','0'.repeat(64)),/Missing historical/);
});
test('default build omits unused caches and optional historical outputs reproduce their original bytes',()=>{
 const reference='design/jango/emoticons/kakao-32/v24',temp='design/jango/emoticons/kakao-32/v'+Date.now();
 fs.mkdirSync(local(temp));
 try{
  for(const file of ['plan.json','selection.json','lettering-record.json'])fs.copyFileSync(local(reference+'/'+file),local(temp+'/'+file));
  for(const dir of ['source-originals','lettering'])fs.mkdirSync(local(temp+'/'+dir));
  for(const file of ['source-originals/29-r1.png','lettering/29.png'])fs.linkSync(local(reference+'/'+file),local(temp+'/'+file));
  const args=['scripts/build-jango-emoticons.mjs','--base='+temp,'--only=29','--partial'];
  execFileSync(process.execPath,args,{stdio:'pipe'});
  const original=readJson(reference+'/manifest.json').find(row=>row.number===29);assert.equal(fileHash(temp+'/stickers/29.png'),original.sha256);
  for(const relative of ['characters','thumbs','preview-120.png'])assert.equal(fs.existsSync(local(temp+'/'+relative)),false);
  execFileSync(process.execPath,[...args,'--keep-intermediates'],{stdio:'pipe'});
  assert.equal(fileHash(temp+'/stickers/29.png'),original.sha256);
  for(const dir of ['characters','thumbs']){
   const entry=readJson(cleanupReceipt).removed.find(row=>row.file==='design/jango/emoticons/kakao-32/v23/'+dir+'/29.png');
   assert.equal(fileHash(temp+'/'+dir+'/29.png'),entry.sha256);
  }
 }finally{fs.rmSync(local(temp),{recursive:true,force:true});}
});
test('SNS policy revisions preserve historical bytes and reject unrecorded changes or artwork exceptions',()=>{
 const registryFile=local('design/jango/cartoon-series.json'),registryBytes=fs.readFileSync(registryFile),registry=JSON.parse(registryBytes);
 const policy=registry.currentProductionPolicy,previous=policy.guideHistory[0];
 const item={file:previous.file,sha256:previous.sha256};
 const temporary='design/jango/quality/history/cartoon-reels-20261020/snapshot-test-'+process.pid+'.txt';
 const temporaryPath=local(temporary);
 const write=()=>fs.writeFileSync(registryFile,JSON.stringify(registry));
 assert.equal(verifyFinalBaselineEvidence(item).status,'archived-policy');
 assert.throws(()=>verifyFinalBaselineEvidence({...item,sha256:'0'.repeat(64)}),/Missing exact historical/);
 assert.throws(()=>verifyFinalBaselineEvidence({file:readJson('design/jango/master-set.json').entries[0].source,sha256:'0'.repeat(64)}),/Historical hash mismatch/);
 try{
  policy.guide.sha256='0'.repeat(64);write();
  assert.throws(()=>verifyFinalBaselineEvidence(item),/Unrecorded current SNS guide change/);
  policy.guide.sha256=fileHash(item.file);policy.guideHistory=[];write();
  assert.throws(()=>verifyFinalBaselineEvidence(item),/Missing exact historical SNS guide snapshot/);
  policy.guideHistory=[{...previous,snapshot:item.file}];write();
  assert.throws(()=>verifyFinalBaselineEvidence(item),/explicit history document/);
  fs.writeFileSync(temporaryPath,'altered historical document');
  policy.guideHistory=[{...previous,snapshot:temporary}];write();
  assert.throws(()=>verifyFinalBaselineEvidence(item),/Historical hash mismatch/);
  fs.unlinkSync(temporaryPath);fs.symlinkSync(local(previous.snapshot),temporaryPath);
  assert.throws(()=>verifyFinalBaselineEvidence(item),/Symlink/);
 }finally{
  fs.writeFileSync(registryFile,registryBytes);fs.rmSync(temporaryPath,{force:true});
 }
 assert.equal(historicalHash(previous.snapshot,item.sha256),item.sha256);
 assert.deepEqual(fs.readFileSync(registryFile),registryBytes);
});
test('final collection keeps the selected 29th design and rejects altered curation or file inventories',()=>{
 const collection=readJson(finalBase+'/collection.json');
 assert.equal(verifyFinalSet(collection).stickers,32);
 const current=readJson('design/jango/emoticons/kakao-32/current.json');
 assert.equal(current.path,finalBase);assert.equal(current.activeCharacterMaster,'v18');assert.equal(current.signedRelease,false);
 const changedSelection=structuredClone(collection);changedSelection.curation.sha256='0'.repeat(64);
 assert.throws(()=>verifyFinalSet(changedSelection),/Selected set changed/);
 const missing=structuredClone(collection);delete missing.files['stickers/29.png'];
 assert.throws(()=>verifyFinalSet(missing),/Final files changed/);
 const extra=structuredClone(collection);extra.files['thumbs/29.png']='0'.repeat(64);
 assert.throws(()=>verifyFinalSet(extra),/Final files changed/);
 const wrong29=structuredClone(collection);wrong29.items[28].origin.file='design/jango/emoticons/kakao-32/v22/stickers/29.png';
 assert.throws(()=>verifyFinalSet(wrong29));
 assert.equal(fs.readdirSync(local(finalBase+'/stickers')).length,32);
 assert.equal(fs.readdirSync(local(finalBase+'/source-originals')).length,32);
 assert.equal(fs.readdirSync(local(finalBase+'/artwork-360')).length,32);
});
