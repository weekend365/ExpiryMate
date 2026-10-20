// Audited retirement of v20–v23. The default is a read-only inventory.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
import {canonical,fileHash,filesIn,local,readJson,sha,validateCandidateRecord,writeJson} from './jango-design-gate.mjs';
import {closedVersions,hasHistory,historyIndex,readHistory,readHistoricalJson,verifyHistory} from './jango-history.mjs';

const base='design/jango/emoticons/kakao-32',archive='design/jango/quality/history/emoticons-v20-v23';
const flags=process.argv.slice(2);assert(flags.every(flag=>['--apply','--check'].includes(flag))&&flags.length<=1,'Use no option, --apply, or --check');
if(hasHistory()){
  if(flags.includes('--check'))for(const row of readHistory().candidates)validateCandidateRecord(readHistoricalJson(row.file,row.sha256));
  console.log(JSON.stringify(verifyHistory()));
}else{
  assert(!flags.includes('--check'),'History cleanup has not been applied');
  const versions=closedVersions.map(version=>base+'/'+version);
  const oldFiles=versions.flatMap(filesIn),media=oldFiles.filter(file=>/\.(png|ttf)$/.test(file));
  const candidates=filesIn('design/jango/quality/candidates').filter(file=>/\d{2}-v(?:20|21|22|23)-r1\.json$/.test(file));
  assert.equal(candidates.length,97,'Unexpected closed candidate inventory');
  const records=candidates.map(file=>({file,sha256:fileHash(file),...readJson(file)}));
  assert(records.every(row=>row.disposition==='candidate'),'Review changed historical dispositions');
  const ids=new Set(records.map(row=>row.id));
  assert(!readJson('design/jango/quality/releases.json').entries.some(row=>ids.has(row.id)),'Released candidates cannot be retired');
  const jobs=records.flatMap(row=>filesIn('design/jango/quality/jobs/'+row.id));
  const reports=records.map(row=>'design/jango/quality/reports/'+row.id+'.json');
  const diagnostics=jobs.filter(file=>file.endsWith('.png'));
  assert.equal(media.length,670);assert.equal(diagnostics.length,97);
  const retained=filesIn(base+'/v18').concat(filesIn(base+'/v24'),filesIn('design/jango/quality/jobs').filter(file=>/\/\d{2}-v24-r1\//.test(file))).filter(file=>/\.(png|ttf)$/.test(file));
  const matches=new Map();for(const file of retained){const hash=fileHash(file);if(!matches.has(hash))matches.set(hash,file);}
  const sourceTargets=new Map();for(const file of retained.filter(file=>/\/source-originals\//.test(file))){const hash=fileHash(file);if(!sourceTargets.has(hash))sourceTargets.set(hash,file);}
  const diagnosticTargets=new Map();for(const file of retained.filter(file=>/\/quality\/jobs\//.test(file))){const hash=fileHash(file);if(!diagnosticTargets.has(hash))diagnosticTargets.set(hash,file);}
  const entries=[];
  const add=(file,target,state)=>entries.push({file,sha256:fileHash(file),bytes:fs.statSync(local(file)).size,state,...(target?{target}:{})});
  for(const file of oldFiles){
    if(/\.(png|ttf)$/.test(file)){
      const hash=fileHash(file),target=file.includes('/source-originals/')?sourceTargets.get(hash):matches.get(hash);
      if(file.includes('/source-originals/'))assert(target,'Original must have identical retained bytes: '+file);
      add(file,target,target?'deduplicated':'retired');
    }else if(file.endsWith('/index.html'))add(file,null,'retired');
    else {const relative=file.slice(base.length+1).replace(/\/README\.md$/,'/README.original.md.txt');add(file,base+'/history/'+relative,'relocated');}
  }
  for(const file of [...candidates,...reports,...jobs]){
    if(file.endsWith('.png')){const target=diagnosticTargets.get(fileHash(file));assert(target,'Diagnostic must have identical retained bytes');add(file,target,'deduplicated');}
    else add(file,archive+'/'+file.slice('design/jango/quality/'.length),'relocated');
  }
  // Preserve the exact old document and final metadata bytes before updating live links/status.
  for(const file of ['design/jango/reference/JANGO-CHARACTER-BIBLE.md','design/jango/reference/JANGO-STYLE-GUIDE.md','design/jango/reference/STYLE-MASTER-ADOPTION.md','design/jango/quality/README.md',base+'/v24/README.md',base+'/v24/collection.json',base+'/v24/inspection-status.json',base+'/current.json'])add(file,archive+'/before/'+file.replace(/\.md$/,'.md.txt'),'relocated');
  const collection=readJson(base+'/v24/collection.json');
  const baseline=[...new Set([...collection.preservation.scopes.flatMap(filesIn),'design/jango/master-set.json','design/jango/style-master.json','design/jango/quality/releases.json'])].filter(file=>!/^design\/jango\/quality\/(?:jobs\/\d{2}-v24-r1\/|candidates\/\d{2}-v24-r1\.json$)/.test(file)).sort().map(file=>({file,sha256:fileHash(file)}));
  assert.equal(sha(canonical(baseline)),collection.preservation.inventorySHA256,'Original preservation baseline changed before retirement');
  const removed=[...media,...diagnostics];
  const index={schemaVersion:1,date:'2026-10-20',status:'closed-historical-records',authorization:'User explicitly requested deletion of all v20–v23 images/fonts and duplicate diagnostics, keeping v18/v24 bytes and moving production records into history.',versions:closedVersions,storagePolicy:'Direct byte aliases only. Original logical references and provenance edges remain unchanged. Retired unique artifacts have no current image verification.',removed:{files:removed.length,bytes:removed.reduce((sum,file)=>sum+fs.statSync(local(file)).size,0),oldMedia:media.length,diagnostics:diagnostics.length,originalsVerified:oldFiles.filter(file=>/\/source-originals\/.+\.png$/.test(file)).length},baseline:{...collection.preservation,files:baseline},priorCleanup:{file:'design/jango/quality/cleanup/20261020.json',sha256:fileHash('design/jango/quality/cleanup/20261020.json')},candidates:records.map(row=>({id:row.id,source:row.source,file:row.file,sha256:row.sha256,status:'closed; not eligible for release'})),entries:entries.sort((a,b)=>a.file.localeCompare(b.file,'en'))};
  assert.equal(index.removed.files,767);assert.equal(index.removed.bytes,316344917);assert.equal(index.removed.originalsVerified,97);
  if(flags.includes('--apply')){
    const backup=fs.mkdtempSync(path.join(os.tmpdir(),'jango-history-cleanup-'));
    writeJsonRelativeBackup();
    function writeJsonRelativeBackup(){
      for(const row of entries){const target=path.join(backup,row.file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(local(row.file),target,fs.constants.COPYFILE_FICLONE);assert.equal(sha(fs.readFileSync(target)),row.sha256);}
      fs.writeFileSync(path.join(backup,'inventory.json'),JSON.stringify(index,null,2)+'\n');
    }
    console.log(JSON.stringify({recovery:backup,note:'Keep until final validation succeeds; no permanent image archive is created.'}));
    // Copy every record before deleting a single old path.
    for(const row of entries.filter(row=>row.state==='relocated')){
      assert(!fs.existsSync(local(row.target)),'Archive destination exists: '+row.target);
      fs.mkdirSync(path.dirname(local(row.target)),{recursive:true});fs.copyFileSync(local(row.file),local(row.target),fs.constants.COPYFILE_FICLONE);assert.equal(fileHash(row.target),row.sha256);
    }
    writeJson(historyIndex,index);
    const resolver=local('scripts/jango-history.mjs'),source=fs.readFileSync(resolver,'utf8');
    assert(source.includes("historyIndexSHA256='PENDING'"),'A different retirement manifest is already pinned');
    fs.writeFileSync(resolver,source.replace("historyIndexSHA256='PENDING'",`historyIndexSHA256='${fileHash(historyIndex)}'`));
    for(const row of entries.filter(row=>!row.target?.startsWith(archive+'/before/'))){assert.equal(fileHash(row.file),row.sha256,'Inventory changed before deletion');fs.unlinkSync(local(row.file));}
    const removeEmpty=directory=>{if(!fs.existsSync(local(directory)))return;for(const entry of fs.readdirSync(local(directory),{withFileTypes:true})){assert(entry.isDirectory(),'Unexpected residual file');removeEmpty(directory+'/'+entry.name);}fs.rmdirSync(local(directory));};
    for(const directory of [...versions,...records.map(row=>'design/jango/quality/jobs/'+row.id)])removeEmpty(directory);
    const fresh=await import(pathToFileURL(resolver).href+'?pinned='+fileHash(historyIndex));
    console.log(JSON.stringify({...fresh.verifyHistory(),recovery:backup}));
  }else console.log(JSON.stringify({status:'dry-run',...index.removed,closedCandidates:records.length,metadata:entries.filter(row=>row.state==='relocated').length,uniqueRetired:entries.filter(row=>row.state==='retired').length}));
}
