// Assemble the user's selected design set. No image generation, promotion or release.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {audit,canonical,fileHash,filesIn,local,prepare,readJson,sha,validateCandidateRecord,writeJson} from './jango-design-gate.mjs';
import {recordReuse} from './record-jango-reuse.mjs';
import {hasHistory,historicalEvidence,historicalHash,historyIndex,readHistoricalJson,readHistory,verifyHistory} from './jango-history.mjs';

export const finalBase='design/jango/emoticons/kakao-32/v24';
const parent='design/jango/emoticons/kakao-32',curation=parent+'/v23/review-set.json';
const pointer=parent+'/current.json',collectionFile=finalBase+'/collection.json';
const scopes=[18,20,21,22,23].map(n=>parent+'/v'+n).concat(['design/jango/masters','design/jango/reference','apps/mobile/assets','design/jango/quality/jobs','design/jango/quality/candidates','design/jango/quality/history']);
const protectedInventory=()=>[...new Set([...scopes.flatMap(filesIn),'design/jango/master-set.json','design/jango/style-master.json','design/jango/quality/releases.json'])].filter(file=>!/^design\/jango\/quality\/(?:jobs\/\d{2}-v24-r1\/|candidates\/\d{2}-v24-r1\.json$)/.test(file)).sort().map(file=>({file,sha256:fileHash(file)}));
const inventory=()=>Object.fromEntries(filesIn(finalBase).filter(file=>file!==collectionFile).map(file=>[file.slice(finalBase.length+1),fileHash(file)]));
const copy=(source,target)=>{
  fs.mkdirSync(path.dirname(local(target)),{recursive:true});
  // Independent files; use filesystem cloning when available, never hardlinks/symlinks.
  fs.copyFileSync(local(source),local(target),fs.constants.COPYFILE_FICLONE);
  assert.equal(fileHash(target),fileHash(source),'Copy changed bytes: '+target);
};
const run=(script,...args)=>execFileSync(process.execPath,['scripts/'+script,...args],{stdio:'pipe'});
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');

export function verifyFinalSet(collection=readJson(collectionFile)){
  assert.equal(collection.version,'v24');
  assert.equal(collection.newImageGeneration,0);
  assert.equal(collection.curation.file,curation);
  assert.equal(historicalHash(curation),collection.curation.sha256,'Selected set changed');
  const selected=readHistoricalJson(curation,collection.curation.sha256).items;
  assert.equal(collection.items.length,32);
  assert.deepEqual(collection.items.map(item=>item.number),Array.from({length:32},(_,i)=>i+1));
  assert.deepEqual(inventory(),collection.files,'Final files changed or unexpected resources exist');
  const manifest=readJson(finalBase+'/manifest.json'),inspection=readJson(finalBase+'/inspection.json');
  const status=readJson(finalBase+'/inspection-status.json').entries;
  for(const item of collection.items){
    const original=selected.find(row=>row.number===item.number),key=String(item.number).padStart(2,'0');
    assert.equal(item.origin.file,original.file);assert.equal(item.origin.source,original.source);
    assert.equal(item.title,original.title);assert.equal(fileHash(finalBase+'/'+item.sticker),original.sha256);
    assert.equal(fileHash(finalBase+'/'+item.source),original.sourceSHA256);
    assert.equal(historicalHash(original.file,original.sha256),original.sha256);assert.equal(historicalHash(original.source,original.sourceSHA256),original.sourceSHA256);
    for(const [folder,expected]of Object.entries(item.retainedLayers))assert.equal(fileHash(finalBase+'/'+folder+'/'+key+'.png'),expected.sha256);
    const candidate=readJson('design/jango/quality/candidates/'+item.id+'.json');validateCandidateRecord(candidate);
    assert.equal(candidate.source,finalBase+'/'+item.source);assert.equal(candidate.sticker,finalBase+'/'+item.sticker);
    const oldBase=path.posix.dirname(path.posix.dirname(original.file)),oldInspection=readHistoricalJson(oldBase+'/inspection.json')[key];
    for(const field of ['mouthRoi','faceRoi','tiltDegrees','visibility','sourceSHA256'])assert.deepEqual(inspection[key][field],oldInspection[field]);
    const oldStatus=readHistoricalJson(oldBase+'/inspection-status.json').entries.find(row=>row.number===item.number&&row.selected);
    assert.equal(status.find(row=>row.number===item.number).mouthStatus,oldStatus.mouthStatus);
    const row=manifest.find(row=>row.number===item.number);
    assert.equal(row.sha256,original.sha256);assert.equal(row.fullBodyPreserved,true);assert.equal(row.captionArtOverlapPixels,0);
  }
  assert.equal(collection.items[28].title,'지쳤어...');
  assert.equal(collection.items[28].origin.file,parent+'/v23/stickers/29.png');
  if(hasHistory()){
    const history=readHistory();verifyHistory();
    assert.equal(sha(canonical(history.baseline.files)),collection.preservation.inventorySHA256,'Historical baseline changed');
    assert.equal(history.baseline.files.length,collection.preservation.files);
    for(const item of history.baseline.files)historicalEvidence(item.file,item.sha256);
    assert.equal(collection.history.file,historyIndex);
    assert.equal(collection.history.sha256,fileHash(historyIndex),'Retirement manifest changed');
    assert.equal(collection.history.originalCollectionSHA256,historicalHash(collectionFile),'Original collection snapshot changed');
    const original=readHistoricalJson(collectionFile);
    // Only README and the truthful preparation status may change in this migration.
    const editable=new Set(['README.md','inspection-status.json']);
    for(const [file,expected]of Object.entries(original.files))if(!editable.has(file))assert.equal(fileHash(finalBase+'/'+file),expected,'Frozen final resource changed: '+file);
    assert.deepEqual(collection.items,original.items,'Selected design origins changed');
  }else assert.equal(sha(canonical(protectedInventory())),collection.preservation.inventorySHA256,'Historical resources changed');
  for(const dir of ['characters','thumbs'])assert(!fs.existsSync(local(finalBase+'/'+dir)),'Unneeded cache generated');
  assert(!fs.existsSync(local(finalBase+'/preview-120.png')));
  if(fs.existsSync(local(pointer))){
    const current=readJson(pointer);assert.equal(current.path,finalBase);assert.equal(current.collectionSHA256,fileHash(collectionFile));
  }
  return {version:'v24',stickers:32,originals:32,captionFree:32,newImageGeneration:0,unchangedBytes:true};
}

function gallery(items){
  const cards=items.map(item=>{
    const key=String(item.number).padStart(2,'0');
    return `<article><h2>${key} · ${escape(item.title)}</h2><img class="asset" data-key="${key}" src="stickers/${key}.png" alt="${escape(item.title)}" width="240" height="240" loading="lazy"><p><a href="stickers/${key}.png" download>완성 PNG</a> · <a href="artwork-360/${key}.png" download>문구 없는 PNG</a> · <a href="${escape(item.source)}">원화</a></p></article>`;
  }).join('');
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>장고 이모티콘 최종 32종</title><style>body{margin:0;background:#f5f6f0;color:#252c28;font:16px/1.65 system-ui,sans-serif}main{max-width:1300px;margin:auto;padding:24px}h1{font-size:28px}h2{font-size:18px}a{color:inherit}nav{display:flex;gap:12px;flex-wrap:wrap;margin:18px 0}button{font:inherit;padding:10px 14px;min-height:44px;border:1px solid #a5b1a9;border-radius:6px;background:transparent;color:inherit;cursor:pointer}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:24px}article{text-align:center;border-top:1px solid #a5b1a9;padding:12px 0}img{object-fit:contain;max-width:100%;height:auto}body.dark{background:#293a31;color:#f5f6f0}details{margin:24px 0}.sheet{overflow:auto}.sheet img{max-width:none}a{overflow-wrap:anywhere}</style><main><h1>장고 · 최종 32종</h1><p>선택한 v22의 31종과 새 29번 ‘지쳤어...’를 한곳에 모았습니다. 원화·문구·서체·크기·배치는 선택본과 같습니다.</p><nav><button id="theme" aria-pressed="false" onclick="toggleTheme()">밝은 / 어두운 배경</button><a href="README.md">폴더 안내</a><a href="collection.json">32종 출처 목록</a></nav><nav><a href="review/preview-light.png">전체 미리보기</a><a href="review/preview-dark.png">어두운 미리보기</a><a href="review/caption-80-dark.png">80px 비교</a><a href="review/caption-120-light.png">120px 비교</a><a href="review/caption-360-light.png">360px 비교</a></nav><nav><button onclick="setMode('stickers')">문구 포함</button><button onclick="setMode('artwork-360')">문구 제외</button>${[80,120,240,360].map(size=>`<button onclick="setSize(${size})">${size}px</button>`).join('')}</nav><section>${cards}</section><details><summary>검토·출시 상태</summary><p>사용자가 선택한 디자인의 정리본입니다. 기존 AI 제작 계보와 입 재검토 상태를 보존했습니다. 서명된 제출용 출력은 기존 promote·export 절차를 따릅니다.</p><p><a href="visual-review.json">기존 관찰 기록</a> · <a href="inspection-status.json">자동 검사</a> · <a href="review/mouth-contact.png">입 진단</a></p></details></main><script>function toggleTheme(){const dark=document.body.classList.toggle('dark');document.getElementById('theme').setAttribute('aria-pressed',String(dark))}function setMode(folder){document.querySelectorAll('.asset').forEach(img=>img.src=folder+'/'+img.dataset.key+'.png')}function setSize(size){document.querySelectorAll('.asset').forEach(img=>{img.width=size;img.height=size})}</script></html>`;
}

export function buildFinalSet(){
  if(fs.existsSync(local(collectionFile))){
    const verified=verifyFinalSet();
    for(const item of readJson(collectionFile).items){
      const report='design/jango/quality/reports/'+item.id+'.json';
      if(!fs.existsSync(local(report)))writeJson(report,audit(item.id));
    }
    return verified;
  }
  assert(!hasHistory(),'Historical inputs are closed; restore the final collection from a verified recovery copy');
  assert(!fs.existsSync(local(finalBase)),'Preserve an existing version; inspect an incomplete assembly before retrying');
  const before=protectedInventory(),selected=readJson(curation).items;
  assert.equal(selected.length,32);
  const plan=[],selection={},inspection={},lettering=[],origins=[];
  const oldReviews=new Map(),type=readJson(parent+'/v22/change-record.json').typography;
  fs.mkdirSync(local(finalBase));
  writeJson(finalBase+'/change-record.json',{date:'2026-10-20',concept:'사용자 선택 최종 32종',inputVersions:['v22','v23'],method:'Byte-identical reuse of the selected v22/v23 originals, lettering and layouts; collection assembly only; no new image generation.',redraws:[],captionChanges:{},typography:type,scope:'user-selected final design collection; candidate-only; no MASTER/app/submission/signed release change'});
  for(const item of selected){
    const key=String(item.number).padStart(2,'0'),oldBase=path.posix.dirname(path.posix.dirname(item.file));
    assert.equal(fileHash(item.file),item.sha256);assert.equal(fileHash(item.source),item.sourceSHA256);
    const p=structuredClone(readJson(oldBase+'/plan.json').find(row=>row.n===item.number));
    const oldSelection=readJson(oldBase+'/selection.json')[key],oldCandidate=readJson('design/jango/quality/candidates/'+oldSelection.jobId+'.json');
    const oldPrepared=readJson(oldCandidate.preflight),id=key+'-v24-r1';
    if(oldCandidate.creativeBrief){
      const brief=readJson(oldCandidate.creativeBrief.file),originalIntent={file:oldCandidate.creativeBrief.file,sha256:fileHash(oldCandidate.creativeBrief.file)};
      p.creativeBrief=finalBase+'/creative-intents/'+key+'.json';
      writeJson(p.creativeBrief,{...brief,authorization:'2026-10-20 user selected the existing result and requested final-version folder/resource organization. Preserve all existing expression pixels; no new illustration.',operation:'layout-lettering-only',retainedExpression:true,allowedWork:['byte-identical-collection'],originalIntent});
    }
    p.operation='layout-lettering-only';
    prepare(id,item.source,'선택된 원화·문구·레터링·전신 배치를 바꾸지 않고 최종 32종 폴더로 정리. 원화는 바이트 그대로 재사용하며 이미지 생성기에 전송하지 않는다.',p.mouthMode,'선택본의 기존 입·표정과 불확실성을 그대로 보존',oldPrepared.expression,{styleProfile:oldCandidate.styleProfile,kind:'emoticon',composition:oldCandidate.composition.file,panel:item.number,...(p.creativeBrief?{creativeBrief:p.creativeBrief}:{})});
    const reuse=recordReuse(id);
    copy(item.source,reuse.source);
    selection[key]={jobId:id,source:'source-originals/'+key+'-r1.png',operation:'layout-lettering-only',origin:item.source,originSHA256:item.sourceSHA256};
    const observed=structuredClone(readJson(oldBase+'/inspection.json')[key]);
    inspection[key]={...observed,provenance:'Byte-identical selected final original; existing ROI, tilt, visibility and uncertainty retained without remeasurement.',originInspection:{file:oldBase+'/inspection.json',sha256:fileHash(oldBase+'/inspection.json')}};
    const letters=structuredClone(readJson(oldBase+'/lettering-record.json').find(row=>row.number===item.number));
    const oldCalibration=letters.calibration.file;letters.calibration.file=finalBase+'/lettering-calibration/'+path.posix.basename(oldCalibration);
    if(fs.existsSync(local(letters.calibration.file)))assert.equal(fileHash(letters.calibration.file),letters.calibration.sha256);else copy(oldCalibration,letters.calibration.file);
    letters.originRecord={file:oldBase+'/lettering-record.json',sha256:fileHash(oldBase+'/lettering-record.json')};
    copy(oldBase+'/lettering/'+key+'.png',finalBase+'/lettering/'+key+'.png');
    lettering.push(letters);plan.push(p);
    oldReviews.set(item.number,{base:oldBase,review:readJson(oldBase+'/visual-review.json').items.find(row=>row.number===item.number)});
    origins.push({number:item.number,id,title:item.title,source:selection[key].source,sticker:'stickers/'+key+'.png',origin:{...item,candidate:oldSelection.jobId,candidateRecord:'design/jango/quality/candidates/'+oldSelection.jobId+'.json',candidateRecordSHA256:fileHash('design/jango/quality/candidates/'+oldSelection.jobId+'.json')},retainedLayers:Object.fromEntries(['artwork','artwork-360','lettering'].map(folder=>[folder,{file:oldBase+'/'+folder+'/'+key+'.png',sha256:fileHash(oldBase+'/'+folder+'/'+key+'.png')}]))});
  }
  writeJson(finalBase+'/plan.json',plan);writeJson(finalBase+'/selection.json',selection);writeJson(finalBase+'/inspection.json',inspection);writeJson(finalBase+'/lettering-record.json',lettering);
  const fontProvenance=readJson(parent+'/v22/fonts/provenance.json');
  for(const name of Object.keys(fontProvenance.files))copy(parent+'/v22/fonts/'+name,finalBase+'/fonts/'+name);
  writeJson(finalBase+'/fonts/provenance.json',{date:'2026-10-20',license:fontProvenance.license,operation:'byte-identical reuse; selected Gamja Flower plus fonts required by the existing lettering renderer',origin:{file:parent+'/v22/fonts/provenance.json',sha256:fileHash(parent+'/v22/fonts/provenance.json')},files:fontProvenance.files});
  run('build-jango-emoticons.mjs','--base='+finalBase);
  for(const item of origins){
    const key=String(item.number).padStart(2,'0');
    assert.equal(fileHash(finalBase+'/'+item.sticker),item.origin.sha256,'Final PNG must not change');
    copy(item.origin.file,finalBase+'/'+item.sticker);
    for(const [folder,layer]of Object.entries(item.retainedLayers)){
      assert.equal(fileHash(finalBase+'/'+folder+'/'+key+'.png'),layer.sha256,'Layer must not change');
      copy(layer.file,finalBase+'/'+folder+'/'+key+'.png');
    }
  }
  run('build-jango-expression-review.mjs','--base='+finalBase);
  run('register-jango-emoticon-review.mjs','--base='+finalBase);
  fs.mkdirSync(local(finalBase+'/review'));
  for(const file of fs.readdirSync(local(finalBase)).filter(file=>file.endsWith('.png')))fs.renameSync(local(finalBase+'/'+file),local(finalBase+'/review/'+file));
  fs.renameSync(local(finalBase+'/faces'),local(finalBase+'/review/faces'));
  copy(parent+'/v23/comparison-v22.png',finalBase+'/review/29-before-after.png');
  const status=readJson(finalBase+'/inspection-status.json').entries;
  const previousReviews=[...new Set([...oldReviews.values()].map(item=>item.base+'/visual-review.json'))].map(file=>({file,sha256:fileHash(file)}));
  writeJson(finalBase+'/visual-review.json',{version:'v24',status:'inherited-observations; user-selected-design; no-signed-release',assembledAt:'2026-10-20',method:'The selected source art, caption, lettering and final PNG bytes are unchanged. Earlier visual observations and mouth uncertainty are inherited with source hashes; no new visual approval is asserted by assembly.',previousReviews,items:origins.map(item=>({...oldReviews.get(item.number).review,id:item.id,sourceOperation:'선택본 바이트 재사용 · 새 생성 없음 · 기존 AI 계보 승계',sourceUnchanged:true,mouthStatus:status.find(row=>row.number===item.number).mouthStatus,preparation:status.find(row=>row.number===item.number).preparation,originObservation:{file:oldReviews.get(item.number).base+'/visual-review.json',number:item.number}})),limitations:['기존 80·120px 관찰과 입 재검토 상태를 보존한다.','디자인 선택과 서명된 제출·출시는 구분한다.']});
  fs.writeFileSync(local(finalBase+'/index.html'),gallery(origins));
  fs.writeFileSync(local(finalBase+'/README.md'),`# 장고 이모티콘 최종 32종 · v24\n\n2026-10-20 사용자가 선택한 디자인을 한 폴더로 정리했습니다. v22의 31종과 v23의 새 29번 **지쳤어...**이며, 원화·문구·폰트·크기·배치·완성 PNG는 선택본과 바이트 단위로 같습니다. 새 이미지 생성은 없습니다.\n\n- [전체 갤러리](index.html) · [전체 미리보기](review/preview-light.png) · [어두운 미리보기](review/preview-dark.png)\n- [stickers](stickers): 문구 포함 360×360 투명 PNG 32장, 01–32 번호순\n- [source-originals](source-originals): 선택된 원화 32장, 01-r1–32-r1 번호순\n- [artwork-360](artwork-360): 완성 PNG와 같은 배치의 문구 없는 360px 이미지 32장\n- [review](review): 밝고 어두운 80·120·360px 비교, 얼굴·입 진단, [29번 전후 비교](review/29-before-after.png)\n- [artwork](artwork) · [lettering](lettering) · [lettering-calibration](lettering-calibration) · [fonts](fonts): 조립·검사·조판 재현에 필요한 작업 자산\n- [collection.json](collection.json): 32종 선택 출처·원본 및 레이어 해시·전체 파일 목록\n- [manifest.json](manifest.json) · [derivation-records](derivation-records): 컷별 출력·생성 없는 재사용 계보\n- [inspection-status.json](inspection-status.json) · [visual-review.json](visual-review.json): 자동 검사와 이전 관찰 기록\n\n기존 버전과 v18 MASTER는 원래 경로의 제작 이력으로 보존합니다. [이력 안내](../history/README.md)를 참고하세요. 기존 AI 제작 계보와 입 재검토 상태를 승계하며, 사용자 선택 디자인의 정리본을 서명된 제출용 출력으로 바꾸지 않습니다. 제출용 출력은 기존 jango:promote·jango:export 절차를 따릅니다.\n\n정리본 검증: \`pnpm jango:final:check\`. 이 폴더의 완성 PNG를 직접 덮어쓰지 않습니다.\n`);
  assert.deepEqual(protectedInventory(),before,'Original assets or historical records changed');
  const collection={version:'v24',status:'user-selected-final-design; candidate-only',assembledAt:'2026-10-20',authorization:'장고 이모티콘 최종 버전으로 폴더 및 리소스 정리해줘.',newImageGeneration:0,curation:{file:curation,sha256:fileHash(curation)},builder:'scripts/build-jango-final-set.mjs',preservation:{scopes,files:before.length,inventorySHA256:sha(canonical(before))},items:origins,files:inventory()};
  writeJson(collectionFile,collection);
  writeJson(pointer,{version:'v24',role:'user-selected-emoticon-design',path:finalBase,gallery:finalBase+'/index.html',collection:collectionFile,collectionSHA256:fileHash(collectionFile),activeCharacterMaster:'v18',signedRelease:false});
  for(const item of origins)writeJson('design/jango/quality/reports/'+item.id+'.json',audit(item.id));
  return verifyFinalSet();
}
export function syncFinalMetadata(){
  const collection=readJson(collectionFile),original=readHistoricalJson(collectionFile);
  const status=readJson(finalBase+'/inspection-status.json');
  for(const entry of status.entries){
    const id=collection.items.find(item=>item.number===entry.number).id,report=readJson('design/jango/quality/reports/'+id+'.json');
    assert.equal(report.mouth.status,entry.mouthStatus,'Mouth uncertainty changed');
    entry.preparation=report.preparation;
  }
  status.historyNote='Preparation became stale after the authorized history resolver and document changes. Original preflight/context and prior inspection status are preserved, not rewritten.';
  writeJson(finalBase+'/inspection-status.json',status);
  collection.history={file:historyIndex,sha256:fileHash(historyIndex),originalCollectionSHA256:historicalHash(collectionFile)};
  assert.deepEqual(collection.items,original.items);
  collection.files=inventory();writeJson(collectionFile,collection);
  const current=readJson(pointer);current.collectionSHA256=fileHash(collectionFile);writeJson(pointer,current);
  return verifyFinalSet();
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(process.argv.includes('--check')?verifyFinalSet():process.argv.includes('--sync-metadata')?syncFinalMetadata():buildFinalSet()));
